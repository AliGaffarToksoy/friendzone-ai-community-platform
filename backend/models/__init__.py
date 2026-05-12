"""
Import all SQLAlchemy models so Flask-Migrate can detect them.
"""

from backend.models.user_model import User
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_model import ChatMessage, ChatUserStatus
from backend.models.chat_room_model import ChatRoom
from backend.models.event_model import Event, EventParticipant, EventReview
from backend.models.brand_model import Brand, EventSponsor, CommunitySponsor
from backend.models.feed_model import FeedPost, FeedLike, FeedComment
from backend.models.gamification_model import Badge, UserBadge, UserPoint, UserPointTransaction
from backend.models.certificate_model import Certificate, UserCertificate
from backend.models.social_room_model import SocialRoom, SocialRoomParticipant
from backend.models.notification_model import Notification

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