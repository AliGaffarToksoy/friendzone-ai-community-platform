"""
Models for chat messages and user status in chat rooms.
"""

from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from backend.database.db_connection import db


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey('communities.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # text, image, system
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime)
    reply_to = db.Column(db.Integer, db.ForeignKey('chat_messages.id'))
    reactions = db.Column(JSON)

    # Relationships
    user = db.relationship('User', back_populates='messages')
    community = db.relationship('Community', back_populates='messages')
    replies = db.relationship('ChatMessage', remote_side=[id])

    def __repr__(self) -> str:
        return f"<ChatMessage {self.id} in community {self.community_id}>"


class ChatUserStatus(db.Model):
    __tablename__ = 'chat_user_status'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_rooms.id'), nullable=False)
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime)
    socket_id = db.Column(db.String(128))
    total_messages = db.Column(db.Integer, default=0)

    # Relationships
    user = db.relationship('User', back_populates='statuses')
    room = db.relationship('ChatRoom', back_populates='statuses')

    def __repr__(self) -> str:
        return f"<ChatUserStatus user={self.user_id} room={self.room_id} online={self.is_online}>"