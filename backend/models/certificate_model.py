"""
Certificate models for FriendZone.

This module contains:
- Certificate
- UserCertificate
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class Certificate(db.Model):
    """
    Certificate definitions.

    Certificates represent higher-value social achievements than badges.
    """

    __tablename__ = "certificates"

    id = db.Column(db.Integer, primary_key=True)

    code = db.Column(db.String(100), nullable=False, unique=True, index=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.String(500), nullable=False)

    category = db.Column(db.String(80), nullable=False, default="social")
    icon = db.Column(db.String(20), nullable=False, default="🎓")

    required_points = db.Column(db.Integer, nullable=False, default=0)
    required_badge_code = db.Column(db.String(100), nullable=True)

    issuer_name = db.Column(db.String(160), nullable=False, default="FriendZone")
    certificate_type = db.Column(db.String(80), nullable=False, default="social_achievement")

    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user_certificates = db.relationship(
        "UserCertificate",
        back_populates="certificate",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(
        self,
        earned: bool = False,
        earned_at: str | None = None,
        certificate_number: str | None = None,
    ) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "required_points": self.required_points,
            "required_badge_code": self.required_badge_code,
            "issuer_name": self.issuer_name,
            "certificate_type": self.certificate_type,
            "is_active": self.is_active,
            "earned": earned,
            "earned_at": earned_at,
            "certificate_number": certificate_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserCertificate(db.Model):
    """
    Certificates earned by users.
    """

    __tablename__ = "user_certificates"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    certificate_id = db.Column(
        db.Integer,
        db.ForeignKey("certificates.id"),
        nullable=False,
        index=True,
    )

    certificate_number = db.Column(db.String(120), nullable=False, unique=True, index=True)

    earned_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    certificate = db.relationship(
        "Certificate",
        back_populates="user_certificates",
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "certificate_id", name="uq_user_certificate"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "certificate_id": self.certificate_id,
            "certificate_number": self.certificate_number,
            "earned_at": self.earned_at.isoformat() if self.earned_at else None,
            "certificate": self.certificate.to_dict(
                earned=True,
                earned_at=self.earned_at.isoformat() if self.earned_at else None,
                certificate_number=self.certificate_number,
            ) if self.certificate else None,
        }