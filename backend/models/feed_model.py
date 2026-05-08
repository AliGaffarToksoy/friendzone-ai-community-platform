"""
Feed models for FriendZone.

This module contains:
- FeedPost
- FeedLike
- FeedComment
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class FeedPost(db.Model):
    """
    Social feed post table.

    Posts can be general user posts, event announcements,
    achievement posts, or community updates.
    """

    __tablename__ = "feed_posts"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

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

    content = db.Column(db.Text, nullable=False)

    post_type = db.Column(db.String(40), nullable=False, default="text")
    visibility = db.Column(db.String(40), nullable=False, default="public")

    image_url = db.Column(db.String(255), nullable=True)
    link_url = db.Column(db.String(255), nullable=True)

    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    likes = db.relationship(
        "FeedLike",
        back_populates="post",
        cascade="all, delete-orphan",
        lazy=True,
    )

    comments = db.relationship(
        "FeedComment",
        back_populates="post",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(
        self,
        user: object | None = None,
        community: object | None = None,
        event: object | None = None,
        like_count: int = 0,
        comment_count: int = 0,
        is_liked_by_me: bool = False,
    ) -> dict:
        """
        Serialize feed post.
        """

        return {
            "id": self.id,
            "user_id": self.user_id,
            "community_id": self.community_id,
            "event_id": self.event_id,
            "content": self.content,
            "post_type": self.post_type,
            "visibility": self.visibility,
            "image_url": self.image_url,
            "link_url": self.link_url,
            "is_pinned": self.is_pinned,
            "is_active": self.is_active,
            "like_count": like_count,
            "comment_count": comment_count,
            "is_liked_by_me": is_liked_by_me,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "profile_image": getattr(user, "profile_image", None),
                "university": getattr(user, "university", None),
                "department": getattr(user, "department", None),
            } if user else None,
            "community": {
                "id": community.id,
                "name": community.name,
                "category": getattr(community, "category", None),
            } if community else None,
            "event": {
                "id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "event_date": event.event_date.isoformat() if event.event_date else None,
            } if event else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<FeedPost {self.id} user={self.user_id}>"


class FeedLike(db.Model):
    """
    Feed post likes.
    """

    __tablename__ = "feed_likes"

    id = db.Column(db.Integer, primary_key=True)

    post_id = db.Column(
        db.Integer,
        db.ForeignKey("feed_posts.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    post = db.relationship(
        "FeedPost",
        back_populates="likes",
    )

    __table_args__ = (
        db.UniqueConstraint("post_id", "user_id", name="uq_feed_like_user"),
    )

    def to_dict(self) -> dict:
        """
        Serialize like.
        """

        return {
            "id": self.id,
            "post_id": self.post_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return f"<FeedLike post={self.post_id} user={self.user_id}>"


class FeedComment(db.Model):
    """
    Feed post comments.
    """

    __tablename__ = "feed_comments"

    id = db.Column(db.Integer, primary_key=True)

    post_id = db.Column(
        db.Integer,
        db.ForeignKey("feed_posts.id"),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    content = db.Column(db.Text, nullable=False)

    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    post = db.relationship(
        "FeedPost",
        back_populates="comments",
    )

    def to_dict(self, user: object | None = None) -> dict:
        """
        Serialize comment.
        """

        return {
            "id": self.id,
            "post_id": self.post_id,
            "user_id": self.user_id,
            "content": self.content,
            "is_active": self.is_active,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "profile_image": getattr(user, "profile_image", None),
            } if user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<FeedComment post={self.post_id} user={self.user_id}>"