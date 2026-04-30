"""
User model for FriendZone.
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class User(db.Model):
    """
    User table.

    Stores authentication information, profile details, personality profile,
    hobbies, profile image, and community discovery preferences.

    Important:
    Related models use back_populates and expect these relationship names:
    - CommunityMember expects User.communities
    - ChatMessage expects User.messages
    - ChatUserStatus expects User.statuses
    """

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    university = db.Column(db.String(180), nullable=True)
    department = db.Column(db.String(180), nullable=True)
    year = db.Column(db.String(50), nullable=True)

    city = db.Column(db.String(120), nullable=True)
    bio = db.Column(db.Text, nullable=True)

    profile_image = db.Column(db.String(255), nullable=True)

    personality_type = db.Column(db.String(8), nullable=True)
    hobbies = db.Column(db.JSON, nullable=True, default=list)

    visibility_scope = db.Column(db.String(30), nullable=False, default="university")
    profile_visibility = db.Column(db.Boolean, nullable=False, default=True)

    is_test_completed = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    communities = db.relationship(
        "CommunityMember",
        back_populates="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    messages = db.relationship(
        "ChatMessage",
        back_populates="user",
        lazy=True,
        cascade="all, delete-orphan",
        foreign_keys="ChatMessage.user_id",
    )

    statuses = db.relationship(
        "ChatUserStatus",
        back_populates="user",
        lazy=True,
        cascade="all, delete-orphan",
        foreign_keys="ChatUserStatus.user_id",
    )

    def to_dict(self) -> dict:
        """
        Serialize user data safely for frontend responses.
        """

        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "university": self.university,
            "department": self.department,
            "year": self.year,
            "city": self.city,
            "bio": self.bio,
            "profile_image": self.profile_image,
            "personality_type": self.personality_type,
            "hobbies": self.hobbies or [],
            "visibility_scope": self.visibility_scope,
            "profile_visibility": self.profile_visibility,
            "is_test_completed": self.is_test_completed,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<User {self.email}>"