"""
Model package for FriendZone.

Import models here so that Flask-Migrate can autogenerate migrations.
"""

from .user_model import User
from .community_model import Community, CommunityMember
from .chat_model import ChatMessage, ChatUserStatus
from .chat_room_model import ChatRoom

__all__ = [
    'User',
    'Community',
    'CommunityMember',
    'ChatMessage',
    'ChatUserStatus',
    'ChatRoom',
]