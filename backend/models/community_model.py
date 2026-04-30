"""
Models related to communities and membership.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.dialects.postgresql import JSON

from backend.database.db_connection import db


class Community(db.Model):
    """
    Community table.

    A community can belong to a university, city, country-wide network,
    or online scope.

    scope values:
    - university: visible mainly to students from the same university
    - city: visible to students in the same city
    - country: visible country-wide
    - online: visible to everyone as an online community
    """

    __tablename__ = "communities"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(80))

    university = db.Column(db.String(180), nullable=True)
    city = db.Column(db.String(120), nullable=True)
    scope = db.Column(db.String(30), nullable=False, default="country")

    tags = db.Column(JSON)
    compatibility_score = db.Column(db.Float)

    is_active = db.Column(db.Boolean, default=True)
    max_members = db.Column(db.Integer, default=100)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    members = db.relationship(
        "CommunityMember",
        back_populates="community",
        cascade="all, delete-orphan",
    )

    messages = db.relationship(
        "ChatMessage",
        back_populates="community",
        cascade="all, delete-orphan",
    )

    chat_room = db.relationship(
        "ChatRoom",
        back_populates="community",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def to_dict(self, member_count: int = 0, compatibility_score: float | None = None) -> dict:
        """
        Serialize community for API responses.
        """

        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "university": self.university,
            "city": self.city,
            "scope": self.scope,
            "tags": self.tags or [],
            "compatibility_score": compatibility_score
            if compatibility_score is not None
            else self.compatibility_score,
            "member_count": member_count,
            "max_members": self.max_members,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Community {self.name}>"


class CommunityMember(db.Model):
    """
    Community membership table.
    """

    __tablename__ = "community_members"

    id = db.Column(db.Integer, primary_key=True)

    community_id = db.Column(
        db.Integer,
        db.ForeignKey("communities.id"),
        nullable=False,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
    )

    role = db.Column(db.String(20), default="member")
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    is_active = db.Column(db.Boolean, default=True)
    last_active = db.Column(db.DateTime)
    message_count = db.Column(db.Integer, default=0)

    user = db.relationship(
        "User",
        back_populates="communities",
    )

    community = db.relationship(
        "Community",
        back_populates="members",
    )

    def __repr__(self) -> str:
        return f"<CommunityMember user={self.user_id} community={self.community_id}>"