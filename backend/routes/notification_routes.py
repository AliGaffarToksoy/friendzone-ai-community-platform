"""
Notification routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.services.notification_service import (
    archive_notification,
    create_notification,
    get_unread_notification_count,
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)
from backend.utils.helpers import error_response, success_response


notification_bp = Blueprint("notifications", __name__)


def get_current_user_id() -> int:
    """
    Return current authenticated user id.
    """

    return int(get_jwt_identity())


def parse_bool(value: object) -> bool:
    """
    Parse truthy query/body values.
    """

    return str(value or "").strip().lower() in {"true", "1", "yes", "on"}


def parse_limit(default: int = 30, maximum: int = 100) -> int:
    """
    Parse safe notification list limit.
    """

    try:
        limit = int(request.args.get("limit", default))
    except Exception:
        limit = default

    if limit < 1:
        return default

    return min(limit, maximum)


@notification_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications() -> tuple:
    """
    List current user's notifications.

    Query params:
    - unread=true
    - limit=30
    """

    user_id = get_current_user_id()

    unread = parse_bool(request.args.get("unread"))
    limit = parse_limit(default=30, maximum=100)

    notifications = get_user_notifications(
        user_id=user_id,
        unread_only=unread,
        limit=limit,
    )

    data = {
        "items": [notification.to_dict() for notification in notifications],
        "unread_count": get_unread_notification_count(user_id),
    }

    return success_response("Bildirimler getirildi.", data)


@notification_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def unread_count() -> tuple:
    """
    Return unread notification count.
    """

    user_id = get_current_user_id()

    return success_response(
        "Okunmamış bildirim sayısı getirildi.",
        {
            "unread_count": get_unread_notification_count(user_id),
        },
    )


@notification_bp.route("/<int:notification_id>/read", methods=["PATCH", "POST"])
@jwt_required()
def read_notification(notification_id: int) -> tuple:
    """
    Mark one notification as read.

    Supports:
    - PATCH /api/notifications/<id>/read
    - POST  /api/notifications/<id>/read
    """

    user_id = get_current_user_id()

    notification = mark_notification_as_read(user_id, notification_id)

    if not notification:
        return error_response("Bildirim bulunamadı.", status_code=404)

    return success_response(
        "Bildirim okundu olarak işaretlendi.",
        {
            "notification": notification.to_dict(),
            "unread_count": get_unread_notification_count(user_id),
        },
    )


@notification_bp.route("/<int:notification_id>", methods=["PATCH"])
@jwt_required()
def update_notification(notification_id: int) -> tuple:
    """
    Update notification state.

    Currently supports:
    - is_read=true
    - is_archived=true

    This exists for frontend compatibility.
    """

    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    is_read_requested = parse_bool(data.get("is_read"))
    is_archived_requested = parse_bool(data.get("is_archived"))

    notification = None

    if is_read_requested:
        notification = mark_notification_as_read(user_id, notification_id)

    if is_archived_requested:
        notification = archive_notification(user_id, notification_id)

    if not notification:
        return error_response("Bildirim bulunamadı veya güncellenecek alan yok.", status_code=404)

    return success_response(
        "Bildirim güncellendi.",
        {
            "notification": notification.to_dict(),
            "unread_count": get_unread_notification_count(user_id),
        },
    )


@notification_bp.route("/mark-all-read", methods=["PATCH", "POST"])
@notification_bp.route("/read-all", methods=["PATCH", "POST"])
@jwt_required()
def read_all_notifications() -> tuple:
    """
    Mark all notifications as read.

    Supports:
    - PATCH /api/notifications/mark-all-read
    - POST  /api/notifications/mark-all-read
    - PATCH /api/notifications/read-all
    - POST  /api/notifications/read-all
    """

    user_id = get_current_user_id()

    count = mark_all_notifications_as_read(user_id)

    return success_response(
        "Tüm bildirimler okundu olarak işaretlendi.",
        {
            "updated_count": count,
            "unread_count": 0,
        },
    )


@notification_bp.route("/<int:notification_id>/archive", methods=["PATCH", "POST"])
@jwt_required()
def archive_single_notification(notification_id: int) -> tuple:
    """
    Archive one notification.

    Supports:
    - PATCH /api/notifications/<id>/archive
    - POST  /api/notifications/<id>/archive
    """

    user_id = get_current_user_id()

    notification = archive_notification(user_id, notification_id)

    if not notification:
        return error_response("Bildirim bulunamadı.", status_code=404)

    return success_response(
        "Bildirim arşivlendi.",
        {
            "notification_id": notification.id,
            "is_archived": notification.is_archived,
            "unread_count": get_unread_notification_count(user_id),
        },
    )


@notification_bp.route("/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id: int) -> tuple:
    """
    Archive notification.

    This matches frontend delete behavior. It does not hard-delete;
    it only archives the notification.
    """

    user_id = get_current_user_id()

    notification = archive_notification(user_id, notification_id)

    if not notification:
        return error_response("Bildirim bulunamadı.", status_code=404)

    return success_response(
        "Bildirim arşivlendi.",
        {
            "notification_id": notification.id,
            "is_archived": notification.is_archived,
            "unread_count": get_unread_notification_count(user_id),
        },
    )


@notification_bp.route("/test", methods=["POST"])
@jwt_required()
def create_test_notification() -> tuple:
    """
    Create test notification for current user.

    Development helper endpoint.
    """

    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    notification = create_notification(
        user_id=user_id,
        notification_type=str(data.get("notification_type", "system")).strip() or "system",
        title=str(data.get("title", "Test bildirimi")).strip() or "Test bildirimi",
        message=str(data.get("message", "FriendZone bildirim sistemi çalışıyor.")).strip(),
        reference_type=str(data.get("reference_type", "")).strip() or None,
        reference_id=data.get("reference_id"),
        action_url=str(data.get("action_url", "")).strip() or None,
        icon=str(data.get("icon", "")).strip() or None,
    )

    return success_response(
        "Test bildirimi oluşturuldu.",
        notification.to_dict(),
        status_code=201,
    )