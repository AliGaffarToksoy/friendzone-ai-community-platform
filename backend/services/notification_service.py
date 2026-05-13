"""
Notification service for FriendZone.
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from backend.database.db_connection import db
from backend.models.community_model import CommunityMember
from backend.models.notification_model import Notification


DEFAULT_NOTIFICATION_ICONS = {
    "badge_awarded": "🏅",
    "certificate_awarded": "🎓",
    "points_added": "⭐",
    "community_joined": "🌐",
    "community_created": "🌐",
    "community_role_updated": "🛡️",
    "event_created": "📅",
    "event_joined": "✅",
    "event_review_created": "💬",
    "sponsor_added": "🤝",
    "community_sponsor_added": "🤝",
    "event_sponsor_added": "🤝",
    "social_room_created": "🎙️",
    "social_room_joined": "🎧",
    "feed_post_created": "💡",
    "feed_comment_created": "💬",
    "system": "🔔",
}


def create_notification(
    user_id: int,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    action_url: str | None = None,
    icon: str | None = None,
    commit: bool = True,
) -> Notification:
    """
    Create a notification for a user.
    """

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url,
        icon=icon or DEFAULT_NOTIFICATION_ICONS.get(notification_type, "🔔"),
        is_read=False,
        is_archived=False,
    )

    db.session.add(notification)

    if commit:
        db.session.commit()

    return notification


def create_unique_notification(
    user_id: int,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    action_url: str | None = None,
    icon: str | None = None,
    commit: bool = True,
) -> tuple[Notification, bool]:
    """
    Create notification only if a matching notification does not already exist.

    Returns:
    - notification
    - created boolean
    """

    existing = None

    if reference_type and reference_id:
        existing = Notification.query.filter_by(
            user_id=user_id,
            notification_type=notification_type,
            reference_type=reference_type,
            reference_id=reference_id,
            is_archived=False,
        ).first()

    if existing:
        return existing, False

    notification = create_notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url,
        icon=icon,
        commit=commit,
    )

    return notification, True


def notify_many(
    user_ids: Iterable[int],
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    action_url: str | None = None,
    icon: str | None = None,
    exclude_user_ids: Iterable[int] | None = None,
    unique: bool = True,
    commit: bool = True,
) -> list[Notification]:
    """
    Create notifications for multiple users.

    This helper avoids duplicated user ids and supports excluding actor user ids.
    """

    excluded = set(int(user_id) for user_id in (exclude_user_ids or []))
    unique_user_ids = []

    for user_id in user_ids:
        try:
            clean_user_id = int(user_id)
        except Exception:
            continue

        if clean_user_id in excluded:
            continue

        if clean_user_id not in unique_user_ids:
            unique_user_ids.append(clean_user_id)

    notifications = []

    for user_id in unique_user_ids:
        if unique:
            notification, created = create_unique_notification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                reference_type=reference_type,
                reference_id=reference_id,
                action_url=action_url,
                icon=icon,
                commit=False,
            )

            if created:
                notifications.append(notification)
        else:
            notification = create_notification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                reference_type=reference_type,
                reference_id=reference_id,
                action_url=action_url,
                icon=icon,
                commit=False,
            )

            notifications.append(notification)

    if commit:
        db.session.commit()

    return notifications


def get_community_admin_user_ids(community_id: int) -> list[int]:
    """
    Return active admin user ids for a community.
    """

    memberships = CommunityMember.query.filter_by(
        community_id=community_id,
        role="admin",
        is_active=True,
    ).all()

    return [membership.user_id for membership in memberships]


def get_community_member_user_ids(community_id: int) -> list[int]:
    """
    Return active member user ids for a community.
    """

    memberships = CommunityMember.query.filter_by(
        community_id=community_id,
        is_active=True,
    ).all()

    return [membership.user_id for membership in memberships]


def notify_community_admins(
    community_id: int,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    action_url: str | None = None,
    icon: str | None = None,
    exclude_user_ids: Iterable[int] | None = None,
    unique: bool = True,
    commit: bool = True,
) -> list[Notification]:
    """
    Notify active community admins.
    """

    admin_user_ids = get_community_admin_user_ids(community_id)

    return notify_many(
        user_ids=admin_user_ids,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url,
        icon=icon,
        exclude_user_ids=exclude_user_ids,
        unique=unique,
        commit=commit,
    )


def notify_community_members(
    community_id: int,
    notification_type: str,
    title: str,
    message: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    action_url: str | None = None,
    icon: str | None = None,
    exclude_user_ids: Iterable[int] | None = None,
    unique: bool = True,
    commit: bool = True,
) -> list[Notification]:
    """
    Notify active community members.
    """

    member_user_ids = get_community_member_user_ids(community_id)

    return notify_many(
        user_ids=member_user_ids,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url,
        icon=icon,
        exclude_user_ids=exclude_user_ids,
        unique=unique,
        commit=commit,
    )


def get_user_notifications(
    user_id: int,
    unread_only: bool = False,
    limit: int = 30,
) -> list[Notification]:
    """
    Return notifications for a user.
    """

    query = Notification.query.filter_by(
        user_id=user_id,
        is_archived=False,
    )

    if unread_only:
        query = query.filter_by(is_read=False)

    limit = max(1, min(int(limit or 30), 100))

    return (
        query
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def get_unread_notification_count(user_id: int) -> int:
    """
    Return unread notification count.
    """

    return Notification.query.filter_by(
        user_id=user_id,
        is_read=False,
        is_archived=False,
    ).count()


def mark_notification_as_read(user_id: int, notification_id: int) -> Notification | None:
    """
    Mark one notification as read.
    """

    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user_id,
        is_archived=False,
    ).first()

    if not notification:
        return None

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.session.commit()

    return notification


def mark_all_notifications_as_read(user_id: int) -> int:
    """
    Mark all user's unread notifications as read.
    """

    notifications = Notification.query.filter_by(
        user_id=user_id,
        is_read=False,
        is_archived=False,
    ).all()

    now = datetime.utcnow()

    for notification in notifications:
        notification.is_read = True
        notification.read_at = now

    db.session.commit()

    return len(notifications)


def archive_notification(user_id: int, notification_id: int) -> Notification | None:
    """
    Archive one notification.
    """

    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user_id,
        is_archived=False,
    ).first()

    if not notification:
        return None

    notification.is_archived = True
    db.session.commit()

    return notification