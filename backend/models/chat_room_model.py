"""
Chat room model for FriendZone.
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class ChatRoom(db.Model):
    """
    Chat room table.

    Each community has one main chat room.

    Important:
    ChatUserStatus model expects ChatRoom.statuses via back_populates="room".
    Therefore the relationship name must be "statuses".
    """

    __tablename__ = "chat_rooms"

    id = db.Column(db.Integer, primary_key=True)

    community_id = db.Column(
        db.Integer,
        db.ForeignKey("communities.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)

    is_active = db.Column(db.Boolean, nullable=False, default=True)

    max_members = db.Column(db.Integer, nullable=False, default=100)
    current_members = db.Column(db.Integer, nullable=False, default=0)

    settings = db.Column(db.JSON, nullable=True, default=dict)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, nullable=True)

    community = db.relationship(
        "Community",
        back_populates="chat_room",
    )

    statuses = db.relationship(
        "ChatUserStatus",
        back_populates="room",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        """
        Serialize chat room.
        """

        return {
            "id": self.id,
            "community_id": self.community_id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "max_members": self.max_members,
            "current_members": self.current_members,
            "settings": self.settings or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
        }

    def __repr__(self) -> str:
        return f"<ChatRoom {self.name}>"