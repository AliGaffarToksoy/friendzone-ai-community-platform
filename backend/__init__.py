"""
FriendZone Flask application factory.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_socketio import SocketIO

from backend.config import Config
from backend.database.db_connection import db
from backend.utils.logger import setup_logger


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

    # Docker veya local fark etmeksizin güvenli frontend origin listesi.
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

    try:
        from .routes.user_routes import user_bp
        app.register_blueprint(user_bp, url_prefix="/api/user")
    except Exception:
        pass

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(test_bp, url_prefix="/api/test")
    app.register_blueprint(community_bp, url_prefix="/api/community")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")
    app.register_blueprint(admin_bp, url_prefix="/admin/api")

    from .socket_events import register_socketio_events
    register_socketio_events(socketio)

    from . import models  # noqa: F401

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