"""
User profile routes for FriendZone.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from flask import Blueprint, current_app, request, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from backend.database.db_connection import db
from backend.models.user_model import User
from backend.models.community_model import CommunityMember
from backend.ml.similarity_engine import find_similar_users
from backend.utils.helpers import success_response, error_response


user_bp = Blueprint("user", __name__)


ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_IMAGE_SIZE_MB = 4


def get_upload_root() -> Path:
    """
    Return upload root path.
    """

    root = Path(current_app.root_path) / "uploads" / "profile_images"
    root.mkdir(parents=True, exist_ok=True)
    return root


def is_allowed_image(filename: str) -> bool:
    """
    Validate image extension.
    """

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_IMAGE_EXTENSIONS


def build_profile_image_url(filename: str | None) -> str | None:
    """
    Build public URL for profile image.
    """

    if not filename:
        return None

    return f"/uploads/profile_images/{filename}"


def serialize_public_profile(user: User, is_own_profile: bool) -> dict:
    """
    Serialize profile data for own/public profile view.

    Own profile can use the full User.to_dict() response.
    Public profile exposes only safe profile fields needed by the UI.
    """

    if is_own_profile:
        data = user.to_dict()
    else:
        data = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "university": user.university,
            "department": user.department,
            "year": user.year,
            "city": user.city,
            "bio": user.bio,
            "profile_image": user.profile_image,
            "personality_type": user.personality_type,
            "hobbies": user.hobbies or [],
            "visibility_scope": user.visibility_scope,
            "profile_visibility": user.profile_visibility,
            "is_test_completed": user.is_test_completed,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }

    joined_count = CommunityMember.query.filter_by(
        user_id=user.id,
        is_active=True,
    ).count()

    data["profile_image_url"] = build_profile_image_url(user.profile_image)
    data["joined_community_count"] = joined_count
    data["is_own_profile"] = is_own_profile

    return data


@user_bp.route("/profile/<int:user_id>", methods=["GET"])
@jwt_required()
def get_profile(user_id: int) -> tuple:
    """
    Return a user's profile.

    Rules:
    - Authenticated user can always view own profile.
    - Other users can view the profile only when profile_visibility is True.
    """

    current_user_id = int(get_jwt_identity())

    user = User.query.get(user_id)

    if not user or not user.is_active:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    is_own_profile = current_user_id == user_id

    if not is_own_profile and not user.profile_visibility:
        return error_response("Bu profil gizli.", status_code=403)

    data = serialize_public_profile(user, is_own_profile)

    return success_response("Profil getirildi.", data)


@user_bp.route("/profile/update", methods=["POST"])
@jwt_required()
def update_profile() -> tuple:
    """
    Update authenticated user's profile details.
    """

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    data = request.get_json() or {}

    name = str(data.get("name", user.name or "")).strip()
    university = str(data.get("university", user.university or "")).strip()
    department = str(data.get("department", user.department or "")).strip()
    year = str(data.get("year", user.year or "")).strip()
    city = str(data.get("city", user.city or "")).strip()
    bio = str(data.get("bio", user.bio or "")).strip()
    visibility_scope = str(data.get("visibility_scope", user.visibility_scope or "university")).strip()
    profile_visibility = data.get("profile_visibility", user.profile_visibility)

    allowed_scopes = {"university", "city", "country"}

    if not name or len(name) < 2:
        return error_response("Ad Soyad en az 2 karakter olmalıdır.")

    if visibility_scope not in allowed_scopes:
        return error_response("Geçersiz keşif tercihi.")

    if len(bio) > 600:
        return error_response("Biyografi en fazla 600 karakter olabilir.")

    user.name = name
    user.university = university or None
    user.department = department or None
    user.year = year or None
    user.city = city or None
    user.bio = bio or None
    user.visibility_scope = visibility_scope
    user.profile_visibility = bool(profile_visibility)

    db.session.commit()

    result = user.to_dict()
    result["profile_image_url"] = build_profile_image_url(user.profile_image)
    result["is_own_profile"] = True

    joined_count = CommunityMember.query.filter_by(
        user_id=user.id,
        is_active=True,
    ).count()

    result["joined_community_count"] = joined_count

    return success_response("Profil güncellendi.", result)


@user_bp.route("/profile/upload-image", methods=["POST"])
@jwt_required()
def upload_profile_image() -> tuple:
    """
    Upload and persist profile image.

    The image is stored under:
        backend/uploads/profile_images/
    """

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    if "image" not in request.files:
        return error_response("Görsel dosyası bulunamadı.")

    file = request.files["image"]

    if not file or file.filename == "":
        return error_response("Geçerli bir görsel seçmelisiniz.")

    if not is_allowed_image(file.filename):
        return error_response("Sadece png, jpg, jpeg veya webp görseller kabul edilir.")

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    max_size_bytes = MAX_IMAGE_SIZE_MB * 1024 * 1024

    if file_size > max_size_bytes:
        return error_response(f"Görsel en fazla {MAX_IMAGE_SIZE_MB}MB olabilir.")

    upload_root = get_upload_root()

    original_name = secure_filename(file.filename)
    extension = original_name.rsplit(".", 1)[1].lower()
    filename = f"user_{user.id}_{uuid.uuid4().hex}.{extension}"

    save_path = upload_root / filename
    file.save(save_path)

    if user.profile_image:
        old_path = upload_root / user.profile_image

        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

    user.profile_image = filename
    db.session.commit()

    return success_response(
        "Profil fotoğrafı yüklendi.",
        {
            "profile_image": filename,
            "profile_image_url": build_profile_image_url(filename),
        },
    )


@user_bp.route("/profile/delete-image", methods=["POST"])
@jwt_required()
def delete_profile_image() -> tuple:
    """
    Delete authenticated user's profile image.
    """

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    upload_root = get_upload_root()

    if user.profile_image:
        image_path = upload_root / user.profile_image

        if image_path.exists():
            try:
                image_path.unlink()
            except Exception:
                pass

    user.profile_image = None
    db.session.commit()

    return success_response("Profil fotoğrafı kaldırıldı.", {
        "profile_image": None,
        "profile_image_url": None,
    })


@user_bp.route("/similar/<int:user_id>", methods=["GET"])
@jwt_required()
def similar_users(user_id: int) -> tuple:
    """
    Return similar users based on hobbies and personality profile.
    """

    current_user_id = int(get_jwt_identity())

    if current_user_id != user_id:
        return error_response("Bu işlem için yetkiniz yok.", status_code=403)

    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    try:
        similar = find_similar_users(user)
    except Exception:
        similar = []

    data = []

    for item in similar:
        if isinstance(item, dict):
            target_user = item.get("user")
            score = item.get("score", 0)
        else:
            target_user = item
            score = 0

        if not target_user:
            continue

        if not target_user.profile_visibility:
            continue

        data.append({
            "id": target_user.id,
            "name": target_user.name,
            "university": target_user.university,
            "department": target_user.department,
            "city": target_user.city,
            "personality_type": target_user.personality_type,
            "hobbies": target_user.hobbies or [],
            "profile_image_url": build_profile_image_url(target_user.profile_image),
            "score": score,
        })

    return success_response("Benzer kullanıcılar getirildi.", data)


@user_bp.route("/uploads/profile_images/<path:filename>", methods=["GET"])
def serve_profile_image(filename: str):
    """
    Serve uploaded profile images.
    """

    upload_root = get_upload_root()
    return send_from_directory(upload_root, filename)