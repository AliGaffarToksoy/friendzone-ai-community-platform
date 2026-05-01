"""
Event models for FriendZone.

This module contains:
- Event
- EventParticipant
- EventReview
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class Event(db.Model):
    """
    Community event table.

    Events belong to a community and can include poster images,
    location, city, capacity, event type, and date.
    """

    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)

    community_id = db.Column(
        db.Integer,
        db.ForeignKey("communities.id"),
        nullable=False,
        index=True,
    )

    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)

    event_type = db.Column(db.String(40), nullable=False, default="offline")
    city = db.Column(db.String(120), nullable=True)
    location = db.Column(db.String(255), nullable=True)

    event_date = db.Column(db.DateTime, nullable=False)
    poster_image = db.Column(db.String(255), nullable=True)

    capacity = db.Column(db.Integer, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    participants = db.relationship(
        "EventParticipant",
        back_populates="event",
        cascade="all, delete-orphan",
        lazy=True,
    )

    reviews = db.relationship(
        "EventReview",
        back_populates="event",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(
        self,
        participant_count: int = 0,
        user_status: str | None = None,
        average_rating: float | None = None,
        review_count: int = 0,
    ) -> dict:
        """
        Serialize event for API responses.
        """

        return {
            "id": self.id,
            "community_id": self.community_id,
            "title": self.title,
            "description": self.description,
            "event_type": self.event_type,
            "city": self.city,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "poster_image": self.poster_image,
            "poster_image_url": f"/uploads/event_posters/{self.poster_image}" if self.poster_image else None,
            "capacity": self.capacity,
            "created_by": self.created_by,
            "is_active": self.is_active,
            "participant_count": participant_count,
            "user_status": user_status,
            "average_rating": average_rating,
            "review_count": review_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Event {self.title}>"


class EventParticipant(db.Model):
    """
    Event participation table.

    status values:
    - going
    - interested
    - cancelled
    """

    __tablename__ = "event_participants"

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    status = db.Column(db.String(30), nullable=False, default="going")
    joined_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    event = db.relationship(
        "Event",
        back_populates="participants",
    )

    __table_args__ = (
        db.UniqueConstraint("event_id", "user_id", name="uq_event_participant_user"),
    )

    def to_dict(self) -> dict:
        """
        Serialize participant.
        """

        return {
            "id": self.id,
            "event_id": self.event_id,
            "user_id": self.user_id,
            "status": self.status,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }

    def __repr__(self) -> str:
        return f"<EventParticipant event={self.event_id} user={self.user_id}>"


class EventReview(db.Model):
    """
    Event review table.
    """

    __tablename__ = "event_reviews"

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    event = db.relationship(
        "Event",
        back_populates="reviews",
    )

    __table_args__ = (
        db.UniqueConstraint("event_id", "user_id", name="uq_event_review_user"),
    )

    def to_dict(self, user_name: str | None = None) -> dict:
        """
        Serialize review.
        """

        return {
            "id": self.id,
            "event_id": self.event_id,
            "user_id": self.user_id,
            "user_name": user_name,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<EventReview event={self.event_id} user={self.user_id}>"