"""
Social room models for FriendZone.

This module contains:
- SocialRoom
- SocialRoomParticipant

Social rooms are Discord-like live/social rooms that can be used for:
- casual conversations
- language practice
- gaming groups
- study rooms
- community voice rooms
- online event rooms
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class SocialRoom(db.Model):
    """
    Discord/Meet-like social room table.

    Rooms can belong to a community and optionally to an event.
    """

    __tablename__ = "social_rooms"

    id = db.Column(db.Integer, primary_key=True)

    community_id = db.Column(
        db.Integer,
        db.ForeignKey("communities.id"),
        nullable=True,
        index=True,
    )

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id"),
        nullable=True,
        index=True,
    )

    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)

    room_type = db.Column(db.String(60), nullable=False, default="casual")
    visibility = db.Column(db.String(40), nullable=False, default="community")

    max_participants = db.Column(db.Integer, nullable=False, default=20)
    current_participants = db.Column(db.Integer, nullable=False, default=0)

    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_live = db.Column(db.Boolean, nullable=False, default=False)
    is_featured = db.Column(db.Boolean, nullable=False, default=False)

    meeting_provider = db.Column(db.String(60), nullable=True)
    meeting_url = db.Column(db.String(500), nullable=True)

    language = db.Column(db.String(80), nullable=True)
    game_title = db.Column(db.String(120), nullable=True)

    scheduled_start = db.Column(db.DateTime, nullable=True)
    scheduled_end = db.Column(db.DateTime, nullable=True)

    last_activity_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    participants = db.relationship(
        "SocialRoomParticipant",
        back_populates="room",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(
        self,
        creator_name: str | None = None,
        community_name: str | None = None,
        event_title: str | None = None,
        viewer_status: str | None = None,
    ) -> dict:
        """
        Serialize room.
        """

        return {
            "id": self.id,
            "community_id": self.community_id,
            "community_name": community_name,
            "event_id": self.event_id,
            "event_title": event_title,
            "created_by": self.created_by,
            "creator_name": creator_name,
            "name": self.name,
            "description": self.description,
            "room_type": self.room_type,
            "visibility": self.visibility,
            "max_participants": self.max_participants,
            "current_participants": self.current_participants,
            "is_active": self.is_active,
            "is_live": self.is_live,
            "is_featured": self.is_featured,
            "meeting_provider": self.meeting_provider,
            "meeting_url": self.meeting_url,
            "language": self.language,
            "game_title": self.game_title,
            "scheduled_start": self.scheduled_start.isoformat() if self.scheduled_start else None,
            "scheduled_end": self.scheduled_end.isoformat() if self.scheduled_end else None,
            "last_activity_at": self.last_activity_at.isoformat() if self.last_activity_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "viewer_status": viewer_status,
        }

    def __repr__(self) -> str:
        return f"<SocialRoom {self.name}>"


class SocialRoomParticipant(db.Model):
    """
    Social room participant table.

    status values:
    - joined
    - left
    - kicked
    """

    __tablename__ = "social_room_participants"

    id = db.Column(db.Integer, primary_key=True)

    room_id = db.Column(
        db.Integer,
        db.ForeignKey("social_rooms.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    status = db.Column(db.String(40), nullable=False, default="joined")
    role = db.Column(db.String(40), nullable=False, default="participant")

    joined_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    left_at = db.Column(db.DateTime, nullable=True)
    last_seen_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    room = db.relationship(
        "SocialRoom",
        back_populates="participants",
    )

    __table_args__ = (
        db.UniqueConstraint("room_id", "user_id", name="uq_social_room_participant_user"),
    )

    def to_dict(self, user=None) -> dict:
        """
        Serialize room participant.
        """

        return {
            "id": self.id,
            "room_id": self.room_id,
            "user_id": self.user_id,
            "status": self.status,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "left_at": self.left_at.isoformat() if self.left_at else None,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "profile_image": getattr(user, "profile_image", None),
                "university": getattr(user, "university", None),
                "department": getattr(user, "department", None),
                "city": getattr(user, "city", None),
            } if user else None,
        }

    def __repr__(self) -> str:
        return f"<SocialRoomParticipant room={self.room_id} user={self.user_id}>"