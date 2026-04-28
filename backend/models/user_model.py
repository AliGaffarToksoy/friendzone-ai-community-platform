"""
SQLAlchemy model for the `users` table.

Represents an application user with authentication credentials,
personal details, MBTI personality type and hobbies.
"""

from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from backend.database.db_connection import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    university = db.Column(db.String(120))
    department = db.Column(db.String(120))
    year = db.Column(db.String(10))
    bio = db.Column(db.Text)
    personality_type = db.Column(db.String(4))
    hobbies = db.Column(JSON)
    is_test_completed = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    communities = db.relationship('CommunityMember', back_populates='user', cascade='all, delete-orphan')
    messages = db.relationship('ChatMessage', back_populates='user', cascade='all, delete-orphan')
    statuses = db.relationship('ChatUserStatus', back_populates='user', cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f"<User {self.email}>"