"""
Notification service for FriendZone.
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db
from backend.models.notification_model import Notification


DEFAULT_NOTIFICATION_ICONS = {
    "badge_awarded": "🏅",
    "certificate_awarded": "🎓",
    "points_added": "⭐",
    "community_joined": "🌐",
    "community_role_updated": "🛡️",
    "event_created": "📅",
    "event_joined": "✅",
    "event_review_created": "💬",
    "sponsor_added": "🤝",
    "social_room_created": "🎙️",
    "social_room_joined": "🎧",
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