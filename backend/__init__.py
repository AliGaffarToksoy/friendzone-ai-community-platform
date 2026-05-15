"""
FriendZone Flask application factory.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_jwt_extended import get_jwt_identity
from flask_migrate import Migrate
from flask_socketio import SocketIO

from backend.config import Config
from backend.database.db_connection import db
from backend.utils.logger import setup_logger
from .routes.brand_routes import brand_bp
from .routes.feed_routes import feed_bp
from .routes.gamification_routes import gamification_bp
from .routes.certificate_routes import certificate_bp
from .routes.social_room_routes import social_room_bp
from .routes.notification_routes import notification_bp
from .routes.moderation_routes import moderation_bp
from backend.utils.helpers import error_response

bcrypt = Bcrypt()
jwt = JWTManager()
migrate = Migrate()
cors = CORS()

socketio = SocketIO(
    cors_allowed_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    async_mode="eventlet",
)


def create_app() -> Flask:
    """
    Create and configure Flask app.
    """

    load_dotenv(override=False)

    app = Flask(__name__)
    app.config.from_object(Config)

    allowed_origins = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    frontend_origin = os.getenv("FRONTEND_ORIGIN")

    if frontend_origin and frontend_origin not in allowed_origins:
        allowed_origins.append(frontend_origin)

    app.config["CORS_HEADERS"] = "Content-Type"

    cors.init_app(
        app,
        resources={
            r"/*": {
                "origins": allowed_origins,
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "supports_credentials": True,
            }
        },
    )

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from backend.models.user_model import User

        identity = jwt_data.get("sub")

        if identity is None:
            return None

        try:
            return User.query.get(int(identity))
        except Exception:
            return None

    @jwt.token_in_blocklist_loader
    def check_if_token_is_revoked(_jwt_header, jwt_data):
        from backend.models.user_model import User

        identity = jwt_data.get("sub")

        if identity is None:
            return True

        try:
            user = User.query.get(int(identity))
        except Exception:
            return True

        return not user or not user.is_active

    @jwt.revoked_token_loader
    def revoked_token_callback(_jwt_header, _jwt_data):
        return error_response(
            "Hesabınız devre dışı bırakılmıştır veya erişim yetkiniz kaldırılmıştır.",
            status_code=403,
        )

    @jwt.token_verification_loader
    def verify_user_is_active(jwt_header: dict, jwt_data: dict) -> bool:
        """
        Reject valid JWT tokens if the user is no longer active.

        This protects the API when an admin deactivates a user after
        the user already has an access token.
        """

        user_id = jwt_data.get("sub")

        if not user_id:
            return False

        try:
            user_id_int = int(user_id)
        except Exception:
            return False

        from backend.models.user_model import User

        user = User.query.get(user_id_int)

        if not user:
            return False

        return bool(user.is_active)

    @jwt.token_verification_failed_loader
    def token_verification_failed(jwt_header: dict, jwt_data: dict):
        """
        Return a clear API response when token verification fails.
        """

        from backend.utils.helpers import error_response

        return error_response(
            "Hesabınız devre dışı bırakılmıştır veya erişim yetkiniz kaldırılmıştır.",
            status_code=403,
        )

    migrate.init_app(app, db)

    socketio.init_app(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode="eventlet",
    )

    setup_logger(app)

    from .routes.auth_routes import auth_bp
    from .routes.test_routes import test_bp
    from .routes.community_routes import community_bp
    from .routes.chat_routes import chat_bp
    from .routes.assistant_routes import assistant_bp
    from .routes.admin_routes import admin_bp
    from .routes.event_routes import event_bp

    try:
        from .routes.user_routes import user_bp
        app.register_blueprint(user_bp, url_prefix="/api/user")
    except Exception as exc:
        app.logger.warning(f"User routes could not be registered: {exc}")

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(test_bp, url_prefix="/api/test")
    app.register_blueprint(community_bp, url_prefix="/api/community")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")
    app.register_blueprint(admin_bp, url_prefix="/admin/api")
    app.register_blueprint(event_bp, url_prefix="/api/events")
    app.register_blueprint(brand_bp, url_prefix="/api/brands")
    app.register_blueprint(feed_bp, url_prefix="/api/feed")
    app.register_blueprint(gamification_bp, url_prefix="/api/gamification")
    app.register_blueprint(certificate_bp, url_prefix="/api/certificates")
    app.register_blueprint(social_room_bp, url_prefix="/api/rooms")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(moderation_bp, url_prefix="/api/moderation")

    from .socket_events import register_socketio_events
    register_socketio_events(socketio)

    from . import models  # noqa: F401

    @app.route("/uploads/profile_images/<path:filename>", methods=["GET"])
    def uploaded_profile_image(filename):
        upload_root = Path(app.root_path) / "uploads" / "profile_images"
        upload_root.mkdir(parents=True, exist_ok=True)

        return send_from_directory(upload_root, filename)

    @app.route("/uploads/event_posters/<path:filename>", methods=["GET"])
    def uploaded_event_poster(filename):
        upload_root = Path(app.root_path) / "uploads" / "event_posters"
        upload_root.mkdir(parents=True, exist_ok=True)

        return send_from_directory(upload_root, filename)

    @app.route("/uploads/brand_logos/<path:filename>", methods=["GET"])
    def uploaded_brand_logo(filename):
        upload_root = Path(app.root_path) / "uploads" / "brand_logos"
        upload_root.mkdir(parents=True, exist_ok=True)

        return send_from_directory(upload_root, filename)

    @app.route("/health", methods=["GET"])
    def health_check():
        return {
            "success": True,
            "message": "FriendZone backend is running",
            "data": {
                "service": "backend",
                "status": "healthy",
            },
        }, 200

    return app