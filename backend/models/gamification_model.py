"""
Gamification models for FriendZone.

This module contains:
- UserPoint
- UserPointTransaction
- Badge
- UserBadge
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class UserPoint(db.Model):
    """
    Stores total social score for each user.
    """

    __tablename__ = "user_points"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    total_points = db.Column(db.Integer, nullable=False, default=0)
    level = db.Column(db.String(80), nullable=False, default="Başlangıç Seviyesi")

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    transactions = db.relationship(
        "UserPointTransaction",
        back_populates="user_point",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "total_points": self.total_points,
            "level": self.level,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserPointTransaction(db.Model):
    """
    Stores point history.
    """

    __tablename__ = "user_point_transactions"

    id = db.Column(db.Integer, primary_key=True)

    user_point_id = db.Column(
        db.Integer,
        db.ForeignKey("user_points.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    action_type = db.Column(db.String(80), nullable=False)
    points = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(255), nullable=True)

    reference_type = db.Column(db.String(80), nullable=True)
    reference_id = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user_point = db.relationship(
        "UserPoint",
        back_populates="transactions",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_point_id": self.user_point_id,
            "user_id": self.user_id,
            "action_type": self.action_type,
            "points": self.points,
            "description": self.description,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Badge(db.Model):
    """
    Badge definitions.
    """

    __tablename__ = "badges"

    id = db.Column(db.Integer, primary_key=True)

    code = db.Column(db.String(80), nullable=False, unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=False)

    icon = db.Column(db.String(20), nullable=False, default="🏅")
    category = db.Column(db.String(80), nullable=False, default="general")

    required_points = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user_badges = db.relationship(
        "UserBadge",
        back_populates="badge",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(self, earned: bool = False, earned_at: str | None = None) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "category": self.category,
            "required_points": self.required_points,
            "is_active": self.is_active,
            "earned": earned,
            "earned_at": earned_at,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserBadge(db.Model):
    """
    Badges earned by users.
    """

    __tablename__ = "user_badges"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    badge_id = db.Column(
        db.Integer,
        db.ForeignKey("badges.id"),
        nullable=False,
        index=True,
    )

    earned_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    badge = db.relationship(
        "Badge",
        back_populates="user_badges",
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "badge_id": self.badge_id,
            "badge": self.badge.to_dict(
                earned=True,
                earned_at=self.earned_at.isoformat() if self.earned_at else None,
            ) if self.badge else None,
            "earned_at": self.earned_at.isoformat() if self.earned_at else None,
        }