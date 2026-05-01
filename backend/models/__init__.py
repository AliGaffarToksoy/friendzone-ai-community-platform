"""
Import all SQLAlchemy models so Flask-Migrate can detect them.
"""

from backend.models.user_model import User
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_model import ChatMessage, ChatUserStatus
from backend.models.chat_room_model import ChatRoom
from backend.models.event_model import Event, EventParticipant, EventReview


__all__ = [
    "User",
    "Community",
    "CommunityMember",
    "ChatMessage",
    "ChatUserStatus",
    "ChatRoom",
    "Event",
    "EventParticipant",
    "EventReview",
]