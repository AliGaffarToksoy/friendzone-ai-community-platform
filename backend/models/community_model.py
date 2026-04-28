"""
Models related to communities and membership.
"""

from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from backend.database.db_connection import db


class Community(db.Model):
    __tablename__ = 'communities'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(80))
    tags = db.Column(JSON)
    compatibility_score = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)
    max_members = db.Column(db.Integer, default=100)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = db.relationship('CommunityMember', back_populates='community', cascade='all, delete-orphan')
    messages = db.relationship('ChatMessage', back_populates='community', cascade='all, delete-orphan')
    chat_room = db.relationship('ChatRoom', back_populates='community', uselist=False, cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f"<Community {self.name}>"


class CommunityMember(db.Model):
    __tablename__ = 'community_members'

    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey('communities.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # admin, moderator, member
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    last_active = db.Column(db.DateTime)
    message_count = db.Column(db.Integer, default=0)

    # Relationships
    user = db.relationship('User', back_populates='communities')
    community = db.relationship('Community', back_populates='members')

    def __repr__(self) -> str:
        return f"<CommunityMember user={self.user_id} community={self.community_id}>"