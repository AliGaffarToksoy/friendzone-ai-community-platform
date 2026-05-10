"""
Certificate routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from backend.models.certificate_model import UserCertificate
from backend.models.user_model import User
from backend.utils.helpers import error_response, success_response


certificate_bp = Blueprint("certificates", __name__)


def safe_iso(value) -> str | None:
    """
    Safely convert datetime-like values to ISO string.
    """

    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def serialize_user_certificate(user_certificate: UserCertificate) -> dict:
    """
    Serialize user certificate with user and certificate details.

    Public verification intentionally avoids exposing sensitive user data.
    """

    user = User.query.get(user_certificate.user_id)
    certificate = user_certificate.certificate

    certificate_data = None

    if certificate:
        certificate_data = certificate.to_dict(
            earned=True,
            earned_at=safe_iso(user_certificate.earned_at),
            certificate_number=user_certificate.certificate_number,
        )

    return {
        "id": user_certificate.id,
        "user_id": user_certificate.user_id,
        "certificate_id": user_certificate.certificate_id,
        "certificate_number": user_certificate.certificate_number,
        "earned_at": safe_iso(user_certificate.earned_at),
        "user": {
            "id": user.id,
            "name": getattr(user, "name", None),
            "university": getattr(user, "university", None),
            "department": getattr(user, "department", None),
            "city": getattr(user, "city", None),
            "profile_image": getattr(user, "profile_image", None),
        } if user else None,
        "certificate": certificate_data,
        "is_valid": bool(certificate and certificate.is_active),
    }


def find_certificate_by_number(certificate_number: str) -> tuple:
    """
    Shared certificate verification logic.
    """

    normalized_number = str(certificate_number or "").strip()

    if not normalized_number:
        return error_response("Sertifika numarası zorunludur.")

    user_certificate = UserCertificate.query.filter_by(
        certificate_number=normalized_number,
    ).first()

    if not user_certificate:
        return error_response("Sertifika bulunamadı.", status_code=404)

    return success_response(
        "Sertifika doğrulandı.",
        serialize_user_certificate(user_certificate),
    )


@certificate_bp.route("/verify", methods=["GET"])
def verify_certificate_query() -> tuple:
    """
    Public certificate verification endpoint using query param.

    Example:
    /api/certificates/verify?number=FZ-SOCIAL_STARTER_CERTIFICATE-10-DDEB85AA
    """

    certificate_number = request.args.get("number", "")

    return find_certificate_by_number(certificate_number)


@certificate_bp.route("/verify/<path:certificate_number>", methods=["GET"])
def verify_certificate_path(certificate_number: str) -> tuple:
    """
    Public certificate verification endpoint using path param.
    Kept for compatibility.
    """

    return find_certificate_by_number(certificate_number)


@certificate_bp.route("/user/<int:user_id>", methods=["GET"])
@jwt_required()
def list_user_certificates(user_id: int) -> tuple:
    """
    List earned certificates for a user.

    This endpoint requires JWT because it returns a user's certificate list.
    """

    user_certificates = (
        UserCertificate.query
        .filter_by(user_id=user_id)
        .order_by(UserCertificate.earned_at.desc())
        .all()
    )

    data = [
        serialize_user_certificate(user_certificate)
        for user_certificate in user_certificates
    ]

    return success_response("Kullanıcı sertifikaları getirildi.", data)