"""
Model for chat rooms.
"""

from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from backend.database.db_connection import db


class ChatRoom(db.Model):
    __tablename__ = 'chat_rooms'

    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey('communities.id'), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    max_members = db.Column(db.Integer, default=100)
    current_members = db.Column(db.Integer, default=0)
    settings = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    community = db.relationship('Community', back_populates='chat_room')
    statuses = db.relationship('ChatUserStatus', back_populates='room', cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f"<ChatRoom community={self.community_id}>"