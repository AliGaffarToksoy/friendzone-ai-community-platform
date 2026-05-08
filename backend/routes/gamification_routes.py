"""
Gamification routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.services.gamification_service import (
    add_points,
    get_gamification_summary,
    seed_default_badges,
    seed_default_certificates,
)
from backend.utils.helpers import error_response, success_response


gamification_bp = Blueprint("gamification", __name__)


def get_current_user_id() -> int:
    """
    Return current authenticated user id.
    """

    return int(get_jwt_identity())


@gamification_bp.route("/me", methods=["GET"])
@jwt_required()
def get_my_gamification() -> tuple:
    """
    Return current user's gamification summary.
    """

    user_id = get_current_user_id()

    data = get_gamification_summary(user_id)

    return success_response("Gamification özeti getirildi.", data)


@gamification_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user_gamification(user_id: int) -> tuple:
    """
    Return selected user's gamification summary.
    """

    data = get_gamification_summary(user_id)

    return success_response("Kullanıcı gamification özeti getirildi.", data)


@gamification_bp.route("/seed-badges", methods=["POST"])
@jwt_required()
def seed_badges() -> tuple:
    """
    Seed default badges.
    """

    badges = seed_default_badges()

    data = [badge.to_dict() for badge in badges]

    return success_response("Varsayılan rozetler oluşturuldu.", data)


@gamification_bp.route("/seed-certificates", methods=["POST"])
@jwt_required()
def seed_certificates() -> tuple:
    """
    Seed default certificates.
    """

    certificates = seed_default_certificates()

    data = [certificate.to_dict() for certificate in certificates]

    return success_response("Varsayılan sertifikalar oluşturuldu.", data)


@gamification_bp.route("/add-points", methods=["POST"])
@jwt_required()
def add_user_points() -> tuple:
    """
    Add points manually.

    This route is useful for development and testing.
    Later, admin authorization can be added.
    """

    current_user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    target_user_id = data.get("user_id") or current_user_id
    action_type = str(data.get("action_type", "manual")).strip()
    points = data.get("points")
    description = str(data.get("description", "")).strip() or None
    reference_type = str(data.get("reference_type", "")).strip() or None
    reference_id = data.get("reference_id")
    allow_duplicate = bool(data.get("allow_duplicate", True))

    if not action_type:
        return error_response("Action type zorunludur.")

    try:
        target_user_id = int(target_user_id)
    except Exception:
        return error_response("Geçerli bir kullanıcı ID girilmelidir.")

    if points is not None:
        try:
            points = int(points)
        except Exception:
            return error_response("Puan değeri sayı olmalıdır.")

    if reference_id is not None:
        try:
            reference_id = int(reference_id)
        except Exception:
            return error_response("Reference ID sayı olmalıdır.")

    result = add_points(
        user_id=target_user_id,
        action_type=action_type,
        points=points,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        allow_duplicate=allow_duplicate,
    )

    return success_response("Puan işlemi tamamlandı.", result)