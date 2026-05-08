"""
Certificate routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import jwt_required

from backend.models.certificate_model import Certificate, UserCertificate
from backend.models.user_model import User
from backend.utils.helpers import error_response, success_response


certificate_bp = Blueprint("certificates", __name__)


def serialize_user_certificate(user_certificate: UserCertificate) -> dict:
    """
    Serialize user certificate with user and certificate details.
    """

    user = User.query.get(user_certificate.user_id)
    certificate = user_certificate.certificate

    return {
        "id": user_certificate.id,
        "user_id": user_certificate.user_id,
        "certificate_id": user_certificate.certificate_id,
        "certificate_number": user_certificate.certificate_number,
        "earned_at": user_certificate.earned_at.isoformat() if user_certificate.earned_at else None,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "university": getattr(user, "university", None),
            "department": getattr(user, "department", None),
            "city": getattr(user, "city", None),
            "profile_image": getattr(user, "profile_image", None),
        } if user else None,
        "certificate": certificate.to_dict(
            earned=True,
            earned_at=user_certificate.earned_at.isoformat() if user_certificate.earned_at else None,
            certificate_number=user_certificate.certificate_number,
        ) if certificate else None,
        "is_valid": bool(certificate and certificate.is_active),
    }


@certificate_bp.route("/verify/<path:certificate_number>", methods=["GET"])
@jwt_required()
def verify_certificate(certificate_number: str) -> tuple:
    """
    Verify certificate by certificate number.
    """

    normalized_number = certificate_number.strip()

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


@certificate_bp.route("/user/<int:user_id>", methods=["GET"])
@jwt_required()
def list_user_certificates(user_id: int) -> tuple:
    """
    List earned certificates for a user.
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