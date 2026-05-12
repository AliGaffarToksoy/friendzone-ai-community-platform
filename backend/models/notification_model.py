"""
Notification models for FriendZone.
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class Notification(db.Model):
    """
    User notification model.

    Stores platform-level notifications such as badge awards,
    certificate awards, event updates, sponsor updates and social actions.
    """

    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(180), nullable=False)
    message = db.Column(db.Text, nullable=True)

    reference_type = db.Column(db.String(80), nullable=True, index=True)
    reference_id = db.Column(db.Integer, nullable=True, index=True)

    action_url = db.Column(db.String(500), nullable=True)
    icon = db.Column(db.String(20), nullable=True)

    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False, index=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref=db.backref("notifications", lazy=True))

    def mark_as_read(self) -> None:
        """
        Mark notification as read.
        """

        self.is_read = True
        self.read_at = datetime.utcnow()

    def to_dict(self) -> dict:
        """
        Serialize notification.
        """

        return {
            "id": self.id,
            "user_id": self.user_id,
            "notification_type": self.notification_type,
            "title": self.title,
            "message": self.message,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "action_url": self.action_url,
            "icon": self.icon,
            "is_read": self.is_read,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }