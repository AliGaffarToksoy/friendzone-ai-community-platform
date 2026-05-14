"""
Moderation and reporting routes for FriendZone.

This API powers:
- User-facing report creation
- Admin moderation dashboard
- Admin actions on users, posts, comments, communities, events, rooms
- Moderation action logs
"""

from __future__ import annotations

from datetime import datetime
from functools import wraps

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.database.db_connection import db
from backend.models.community_model import Community
from backend.models.event_model import Event
from backend.models.feed_model import FeedComment, FeedPost
from backend.models.moderation_model import ModerationAction, ModerationReport, UserWarning
from backend.models.social_room_model import SocialRoom
from backend.models.user_model import User
from backend.services.notification_service import create_notification
from backend.utils.helpers import error_response, success_response


moderation_bp = Blueprint("moderation", __name__)


VALID_TARGET_TYPES = {
    "user",
    "feed_post",
    "feed_comment",
    "community",
    "event",
    "social_room",
    "chat_message",
}

VALID_REPORT_STATUSES = {
    "pending",
    "reviewing",
    "resolved",
    "rejected",
}

VALID_SEVERITIES = {
    "low",
    "medium",
    "high",
    "critical",
}

VALID_REPORT_REASONS = {
    "spam",
    "harassment",
    "hate_speech",
    "violence",
    "sexual_content",
    "misinformation",
    "scam",
    "privacy",
    "impersonation",
    "off_topic",
    "other",
}


def admin_required(func):
    """
    Enforce basic authentication for admin moderation routes.
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return "", 204

        auth = request.authorization

        if not auth:
            return error_response("Yetkisiz erişim.", status_code=401)

        expected_username = current_app.config.get("ADMIN_USERNAME", "admin")
        expected_password = current_app.config.get("ADMIN_PASSWORD", "admin123")

        if auth.username != expected_username or auth.password != expected_password:
            return error_response("Yetkisiz erişim.", status_code=401)

        return func(*args, **kwargs)

    return wrapper


def get_current_user_id_or_none() -> int | None:
    """
    Return JWT user id if available.
    """

    try:
        identity = get_jwt_identity()
        return int(identity) if identity is not None else None
    except Exception:
        return None


def normalize_text(value: object, default: str = "") -> str:
    """
    Normalize request text value.
    """

    return str(value if value is not None else default).strip()


def parse_int(value: object, default: int | None = None) -> int | None:
    """
    Parse integer safely.
    """

    try:
        return int(value)
    except Exception:
        return default


def get_request_data() -> dict:
    """
    Return JSON body safely.
    """

    return request.get_json(silent=True) or {}


def get_target_object(target_type: str, target_id: int) -> object | None:
    """
    Resolve target object by type.
    """

    if target_type == "user":
        return User.query.get(target_id)

    if target_type == "feed_post":
        return FeedPost.query.get(target_id)

    if target_type == "feed_comment":
        return FeedComment.query.get(target_id)

    if target_type == "community":
        return Community.query.get(target_id)

    if target_type == "event":
        return Event.query.get(target_id)

    if target_type == "social_room":
        return SocialRoom.query.get(target_id)

    return None


def get_target_owner_user_id(target_type: str, target_object: object | None) -> int | None:
    """
    Return owner/user id of target if available.
    """

    if not target_object:
        return None

    if target_type == "user":
        return getattr(target_object, "id", None)

    if target_type in {"feed_post", "feed_comment"}:
        return getattr(target_object, "user_id", None)

    if target_type == "community":
        return getattr(target_object, "created_by", None)

    if target_type == "event":
        return getattr(target_object, "created_by", None)

    if target_type == "social_room":
        return getattr(target_object, "created_by", None) or getattr(target_object, "host_user_id", None)

    return None


def make_target_summary(target_type: str, target_object: object | None) -> dict | None:
    """
    Create compact target summary for admin UI.
    """

    if not target_object:
        return None

    if target_type == "user":
        return {
            "id": target_object.id,
            "type": "user",
            "title": target_object.name,
            "subtitle": target_object.email,
            "is_active": target_object.is_active,
        }

    if target_type == "feed_post":
        return {
            "id": target_object.id,
            "type": "feed_post",
            "title": "Feed gönderisi",
            "subtitle": (target_object.content or "")[:180],
            "user_id": target_object.user_id,
            "is_active": target_object.is_active,
        }

    if target_type == "feed_comment":
        return {
            "id": target_object.id,
            "type": "feed_comment",
            "title": "Feed yorumu",
            "subtitle": (target_object.content or "")[:180],
            "user_id": target_object.user_id,
            "post_id": target_object.post_id,
            "is_active": target_object.is_active,
        }

    if target_type == "community":
        return {
            "id": target_object.id,
            "type": "community",
            "title": target_object.name,
            "subtitle": target_object.description,
            "created_by": target_object.created_by,
            "is_active": target_object.is_active,
        }

    if target_type == "event":
        return {
            "id": target_object.id,
            "type": "event",
            "title": target_object.title,
            "subtitle": target_object.description,
            "community_id": target_object.community_id,
            "created_by": target_object.created_by,
            "is_active": target_object.is_active,
        }

    if target_type == "social_room":
        return {
            "id": target_object.id,
            "type": "social_room",
            "title": getattr(target_object, "title", None) or getattr(target_object, "name", None),
            "subtitle": getattr(target_object, "description", None),
            "created_by": getattr(target_object, "created_by", None),
            "is_active": getattr(target_object, "is_active", None),
        }

    return {
        "id": getattr(target_object, "id", None),
        "type": target_type,
        "title": target_type,
    }


def serialize_report(report: ModerationReport) -> dict:
    """
    Serialize report with related users and target summary.
    """

    reporter = User.query.get(report.reporter_user_id) if report.reporter_user_id else None
    reported_user = User.query.get(report.reported_user_id) if report.reported_user_id else None
    reviewer = User.query.get(report.reviewed_by) if report.reviewed_by else None
    target_object = get_target_object(report.target_type, report.target_id)

    return report.to_dict(
        reporter=reporter,
        reported_user=reported_user,
        reviewer=reviewer,
        target_summary=make_target_summary(report.target_type, target_object),
    )


def serialize_action(action: ModerationAction) -> dict:
    """
    Serialize moderation action with related users.
    """

    admin_user = User.query.get(action.admin_user_id) if action.admin_user_id else None
    target_user = User.query.get(action.target_user_id) if action.target_user_id else None
    report = ModerationReport.query.get(action.report_id) if action.report_id else None

    return action.to_dict(
        admin_user=admin_user,
        target_user=target_user,
        report=report,
    )


def create_moderation_action(
    action_type: str,
    target_type: str,
    target_id: int,
    admin_user_id: int | None = None,
    target_user_id: int | None = None,
    report_id: int | None = None,
    reason: str | None = None,
    note: str | None = None,
    metadata: dict | None = None,
    commit: bool = False,
) -> ModerationAction:
    """
    Create moderation action log.
    """

    action = ModerationAction(
        admin_user_id=admin_user_id,
        report_id=report_id,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        target_user_id=target_user_id,
        reason=reason,
        note=note,
        metadata_json=metadata or {},
    )

    db.session.add(action)

    if commit:
        db.session.commit()

    return action


@moderation_bp.route("/reports", methods=["POST"])
@jwt_required()
def create_report() -> tuple:
    """
    Create a user report.

    Body:
    - target_type
    - target_id
    - reason
    - description
    - severity optional
    """

    reporter_user_id = int(get_jwt_identity())
    data = get_request_data()

    target_type = normalize_text(data.get("target_type")).lower()
    target_id = parse_int(data.get("target_id"))
    reason = normalize_text(data.get("reason"), "other").lower()
    description = normalize_text(data.get("description"))
    severity = normalize_text(data.get("severity"), "medium").lower()

    if target_type not in VALID_TARGET_TYPES:
        return error_response("Geçersiz rapor hedef tipi.")

    if not target_id:
        return error_response("Rapor hedef ID zorunludur.")

    if reason not in VALID_REPORT_REASONS:
        reason = "other"

    if severity not in VALID_SEVERITIES:
        severity = "medium"

    target_object = get_target_object(target_type, target_id)

    if not target_object:
        return error_response("Raporlanacak hedef bulunamadı.", status_code=404)

    reported_user_id = get_target_owner_user_id(target_type, target_object)

    if reported_user_id and reported_user_id == reporter_user_id:
        return error_response(
            "Kendi içeriğinizi veya profilinizi raporlayamazsınız.",
            status_code=400,
        )

    existing_pending = ModerationReport.query.filter_by(
        reporter_user_id=reporter_user_id,
        target_type=target_type,
        target_id=target_id,
        status="pending",
    ).first()

    if existing_pending:
        return error_response("Bu hedef için bekleyen bir raporunuz zaten var.", status_code=409)

    report = ModerationReport(
        reporter_user_id=reporter_user_id,
        target_type=target_type,
        target_id=target_id,
        reported_user_id=reported_user_id,
        reason=reason,
        description=description or None,
        status="pending",
        severity=severity,
    )

    db.session.add(report)
    db.session.commit()

    return success_response("Rapor oluşturuldu.", serialize_report(report), status_code=201)

@moderation_bp.route("/admin/overview", methods=["GET"])
@admin_required
def admin_moderation_overview() -> tuple:
    """
    Return moderation overview for admin dashboard.
    """

    total_reports = ModerationReport.query.count()
    pending_reports = ModerationReport.query.filter_by(status="pending").count()
    reviewing_reports = ModerationReport.query.filter_by(status="reviewing").count()
    resolved_reports = ModerationReport.query.filter_by(status="resolved").count()
    rejected_reports = ModerationReport.query.filter_by(status="rejected").count()

    critical_reports = ModerationReport.query.filter_by(severity="critical").filter(
        ModerationReport.status.in_(["pending", "reviewing"])
    ).count()

    inactive_users = User.query.filter_by(is_active=False).count()
    hidden_posts = FeedPost.query.filter_by(is_active=False).count()
    hidden_comments = FeedComment.query.filter_by(is_active=False).count()
    inactive_communities = Community.query.filter_by(is_active=False).count()
    inactive_events = Event.query.filter_by(is_active=False).count()

    latest_reports = (
        ModerationReport.query
        .order_by(ModerationReport.created_at.desc())
        .limit(8)
        .all()
    )

    latest_actions = (
        ModerationAction.query
        .order_by(ModerationAction.created_at.desc())
        .limit(8)
        .all()
    )

    return success_response("Moderasyon özeti getirildi.", {
        "stats": {
            "total_reports": total_reports,
            "pending_reports": pending_reports,
            "reviewing_reports": reviewing_reports,
            "resolved_reports": resolved_reports,
            "rejected_reports": rejected_reports,
            "critical_reports": critical_reports,
            "inactive_users": inactive_users,
            "hidden_posts": hidden_posts,
            "hidden_comments": hidden_comments,
            "inactive_communities": inactive_communities,
            "inactive_events": inactive_events,
        },
        "latest_reports": [serialize_report(report) for report in latest_reports],
        "latest_actions": [serialize_action(action) for action in latest_actions],
    })


@moderation_bp.route("/admin/reports", methods=["GET"])
@admin_required
def admin_list_reports() -> tuple:
    """
    List reports for admin.

    Query params:
    - status
    - severity
    - target_type
    - q
    - limit
    """

    query = ModerationReport.query

    status = normalize_text(request.args.get("status")).lower()
    severity = normalize_text(request.args.get("severity")).lower()
    target_type = normalize_text(request.args.get("target_type")).lower()
    search = normalize_text(request.args.get("q"))

    if status and status in VALID_REPORT_STATUSES:
        query = query.filter(ModerationReport.status == status)

    if severity and severity in VALID_SEVERITIES:
        query = query.filter(ModerationReport.severity == severity)

    if target_type and target_type in VALID_TARGET_TYPES:
        query = query.filter(ModerationReport.target_type == target_type)

    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                ModerationReport.reason.ilike(like),
                ModerationReport.description.ilike(like),
                ModerationReport.admin_note.ilike(like),
            )
        )

    try:
        limit = int(request.args.get("limit", 50))
    except Exception:
        limit = 50

    limit = min(max(limit, 1), 200)

    reports = (
        query
        .order_by(
            ModerationReport.status.asc(),
            ModerationReport.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return success_response("Moderasyon raporları getirildi.", {
        "items": [serialize_report(report) for report in reports],
        "count": len(reports),
    })


@moderation_bp.route("/admin/reports/<int:report_id>", methods=["GET"])
@admin_required
def admin_get_report(report_id: int) -> tuple:
    """
    Return report detail.
    """

    report = ModerationReport.query.get(report_id)

    if not report:
        return error_response("Rapor bulunamadı.", status_code=404)

    actions = (
        ModerationAction.query
        .filter_by(report_id=report.id)
        .order_by(ModerationAction.created_at.desc())
        .all()
    )

    data = serialize_report(report)
    data["actions"] = [serialize_action(action) for action in actions]

    return success_response("Rapor detayı getirildi.", data)


@moderation_bp.route("/admin/reports/<int:report_id>/status", methods=["PATCH", "POST"])
@admin_required
def admin_update_report_status(report_id: int) -> tuple:
    """
    Update report status.
    """

    report = ModerationReport.query.get(report_id)

    if not report:
        return error_response("Rapor bulunamadı.", status_code=404)

    data = get_request_data()

    status = normalize_text(data.get("status")).lower()
    admin_note = normalize_text(data.get("admin_note"))
    admin_user_id = parse_int(data.get("admin_user_id"))

    if status not in VALID_REPORT_STATUSES:
        return error_response("Geçersiz rapor durumu.")

    report.status = status
    report.admin_note = admin_note or report.admin_note

    if status in {"reviewing", "resolved", "rejected"}:
        report.reviewed_at = datetime.utcnow()
        report.reviewed_by = admin_user_id

    action_type = {
        "pending": "mark_report_pending",
        "reviewing": "review_report",
        "resolved": "resolve_report",
        "rejected": "reject_report",
    }.get(status, "update_report_status")

    create_moderation_action(
        action_type=action_type,
        target_type=report.target_type,
        target_id=report.target_id,
        target_user_id=report.reported_user_id,
        report_id=report.id,
        admin_user_id=admin_user_id,
        reason=report.reason,
        note=admin_note,
        commit=False,
    )

    db.session.commit()

    return success_response("Rapor durumu güncellendi.", serialize_report(report))


@moderation_bp.route("/admin/actions", methods=["GET"])
@admin_required
def admin_list_actions() -> tuple:
    """
    List moderation action logs.
    """

    query = ModerationAction.query

    action_type = normalize_text(request.args.get("action_type"))
    target_type = normalize_text(request.args.get("target_type"))

    if action_type:
        query = query.filter(ModerationAction.action_type == action_type)

    if target_type:
        query = query.filter(ModerationAction.target_type == target_type)

    try:
        limit = int(request.args.get("limit", 50))
    except Exception:
        limit = 50

    limit = min(max(limit, 1), 200)

    actions = (
        query
        .order_by(ModerationAction.created_at.desc())
        .limit(limit)
        .all()
    )

    return success_response("Moderasyon aksiyonları getirildi.", {
        "items": [serialize_action(action) for action in actions],
        "count": len(actions),
    })


@moderation_bp.route("/admin/users", methods=["GET"])
@admin_required
def admin_search_users() -> tuple:
    """
    Search users for moderation.
    """

    query = User.query

    search = normalize_text(request.args.get("q"))
    status = normalize_text(request.args.get("status")).lower()

    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                User.name.ilike(like),
                User.email.ilike(like),
                User.university.ilike(like),
                User.department.ilike(like),
            )
        )

    if status == "active":
        query = query.filter(User.is_active.is_(True))

    if status == "inactive":
        query = query.filter(User.is_active.is_(False))

    users = query.order_by(User.created_at.desc()).limit(100).all()

    return success_response("Kullanıcılar getirildi.", {
        "items": [user.to_dict() for user in users],
        "count": len(users),
    })


@moderation_bp.route("/admin/action", methods=["POST"])
@admin_required
def admin_take_action() -> tuple:
    """
    Take an admin moderation action.

    Body:
    - action_type
    - target_type
    - target_id
    - report_id optional
    - admin_user_id optional
    - reason optional
    - note optional
    """

    data = get_request_data()

    action_type = normalize_text(data.get("action_type")).lower()
    target_type = normalize_text(data.get("target_type")).lower()
    target_id = parse_int(data.get("target_id"))
    report_id = parse_int(data.get("report_id"))
    admin_user_id = parse_int(data.get("admin_user_id"))
    reason = normalize_text(data.get("reason"))
    note = normalize_text(data.get("note"))

    if not action_type:
        return error_response("Aksiyon tipi zorunludur.")

    if target_type not in VALID_TARGET_TYPES:
        return error_response("Geçersiz hedef tipi.")

    if not target_id:
        return error_response("Hedef ID zorunludur.")

    target_object = get_target_object(target_type, target_id)

    if not target_object:
        return error_response("Hedef bulunamadı.", status_code=404)

    target_user_id = get_target_owner_user_id(target_type, target_object)

    applied = apply_admin_action(
        action_type=action_type,
        target_type=target_type,
        target_object=target_object,
        target_user_id=target_user_id,
        report_id=report_id,
        admin_user_id=admin_user_id,
        reason=reason,
        note=note,
    )

    if not applied["success"]:
        return error_response(applied["message"], status_code=400)

    action = create_moderation_action(
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        target_user_id=target_user_id,
        report_id=report_id,
        admin_user_id=admin_user_id,
        reason=reason,
        note=note,
        metadata=applied.get("metadata"),
        commit=False,
    )

    if report_id:
        report = ModerationReport.query.get(report_id)

        if report:
            report.status = "resolved"
            report.admin_note = note or report.admin_note
            report.reviewed_by = admin_user_id
            report.reviewed_at = datetime.utcnow()

    db.session.commit()

    notify_target_user_after_action(
        action_type=action_type,
        target_type=target_type,
        target_object=target_object,
        target_user_id=target_user_id,
        note=note,
        reason=reason,
    )

    return success_response("Moderasyon aksiyonu uygulandı.", serialize_action(action))


def apply_admin_action(
    action_type: str,
    target_type: str,
    target_object: object,
    target_user_id: int | None,
    report_id: int | None,
    admin_user_id: int | None,
    reason: str,
    note: str,
) -> dict:
    """
    Apply moderation action to target.
    """

    if action_type == "warn_user":
        if target_type != "user":
            return {
                "success": False,
                "message": "Kullanıcı uyarısı için hedef tipi user olmalıdır.",
            }

        warning = UserWarning(
            user_id=target_object.id,
            admin_user_id=admin_user_id,
            report_id=report_id,
            title="FriendZone moderasyon uyarısı",
            message=note or reason or "Platform kurallarına aykırı davranış nedeniyle uyarı aldınız.",
            severity="medium",
        )

        db.session.add(warning)

        return {
            "success": True,
            "metadata": {"warning_id": warning.id},
        }

    if action_type == "deactivate_user":
        if target_type != "user":
            return {
                "success": False,
                "message": "Kullanıcı pasifleştirme için hedef tipi user olmalıdır.",
            }

        target_object.is_active = False

        return {
            "success": True,
            "metadata": {"is_active": False},
        }

    if action_type == "reactivate_user":
        if target_type != "user":
            return {
                "success": False,
                "message": "Kullanıcı aktifleştirme için hedef tipi user olmalıdır.",
            }

        target_object.is_active = True

        return {
            "success": True,
            "metadata": {"is_active": True},
        }

    if action_type == "hide_feed_post":
        if target_type != "feed_post":
            return {
                "success": False,
                "message": "Gönderi gizleme için hedef tipi feed_post olmalıdır.",
            }

        target_object.is_active = False

        return {
            "success": True,
            "metadata": {"is_active": False},
        }

    if action_type == "restore_feed_post":
        if target_type != "feed_post":
            return {
                "success": False,
                "message": "Gönderi geri alma için hedef tipi feed_post olmalıdır.",
            }

        target_object.is_active = True

        return {
            "success": True,
            "metadata": {"is_active": True},
        }

    if action_type == "hide_feed_comment":
        if target_type != "feed_comment":
            return {
                "success": False,
                "message": "Yorum gizleme için hedef tipi feed_comment olmalıdır.",
            }

        target_object.is_active = False

        return {
            "success": True,
            "metadata": {"is_active": False},
        }

    if action_type == "restore_feed_comment":
        if target_type != "feed_comment":
            return {
                "success": False,
                "message": "Yorum geri alma için hedef tipi feed_comment olmalıdır.",
            }

        target_object.is_active = True

        return {
            "success": True,
            "metadata": {"is_active": True},
        }

    if action_type == "deactivate_community":
        if target_type != "community":
            return {
                "success": False,
                "message": "Topluluk pasifleştirme için hedef tipi community olmalıdır.",
            }

        target_object.is_active = False

        return {
            "success": True,
            "metadata": {"is_active": False},
        }

    if action_type == "reactivate_community":
        if target_type != "community":
            return {
                "success": False,
                "message": "Topluluk aktifleştirme için hedef tipi community olmalıdır.",
            }

        target_object.is_active = True

        return {
            "success": True,
            "metadata": {"is_active": True},
        }

    if action_type == "deactivate_event":
        if target_type != "event":
            return {
                "success": False,
                "message": "Etkinlik pasifleştirme için hedef tipi event olmalıdır.",
            }

        target_object.is_active = False

        return {
            "success": True,
            "metadata": {"is_active": False},
        }

    if action_type == "reactivate_event":
        if target_type != "event":
            return {
                "success": False,
                "message": "Etkinlik aktifleştirme için hedef tipi event olmalıdır.",
            }

        target_object.is_active = True

        return {
            "success": True,
            "metadata": {"is_active": True},
        }

    if action_type == "close_social_room":
        if target_type != "social_room":
            return {
                "success": False,
                "message": "Sosyal oda kapatma için hedef tipi social_room olmalıdır.",
            }

        if hasattr(target_object, "is_active"):
            target_object.is_active = False

        if hasattr(target_object, "status"):
            target_object.status = "closed"

        return {
            "success": True,
            "metadata": {
                "is_active": getattr(target_object, "is_active", None),
                "status": getattr(target_object, "status", None),
            },
        }

    return {
        "success": False,
        "message": "Desteklenmeyen moderasyon aksiyonu.",
    }


def notify_target_user_after_action(
    action_type: str,
    target_type: str,
    target_object: object,
    target_user_id: int | None,
    note: str,
    reason: str,
) -> None:
    """
    Notify affected user after moderation action.
    """

    if not target_user_id:
        return

    title_map = {
        "warn_user": "Moderasyon uyarısı aldın",
        "deactivate_user": "Hesabın geçici olarak pasifleştirildi",
        "reactivate_user": "Hesabın yeniden aktifleştirildi",
        "hide_feed_post": "Gönderin moderasyon tarafından gizlendi",
        "restore_feed_post": "Gönderin yeniden yayına alındı",
        "hide_feed_comment": "Yorumun moderasyon tarafından gizlendi",
        "restore_feed_comment": "Yorumun yeniden yayına alındı",
        "deactivate_community": "Topluluğun moderasyon tarafından pasifleştirildi",
        "reactivate_community": "Topluluğun yeniden aktifleştirildi",
        "deactivate_event": "Etkinliğin moderasyon tarafından pasifleştirildi",
        "reactivate_event": "Etkinliğin yeniden aktifleştirildi",
        "close_social_room": "Sosyal odan moderasyon tarafından kapatıldı",
    }

    title = title_map.get(action_type, "Moderasyon aksiyonu uygulandı")

    message = note or reason or "FriendZone moderasyon ekibi tarafından bir aksiyon uygulandı."

    action_url = "notifications.html"

    if target_type == "community":
        action_url = f"community.html?id={target_object.id}"

    if target_type == "event":
        action_url = f"community.html?id={target_object.community_id}"

    if target_type == "feed_post":
        action_url = "feed.html"

    if target_type == "feed_comment":
        action_url = "feed.html"

    if target_type == "user":
        action_url = "social-profile.html"

    create_notification(
        user_id=target_user_id,
        notification_type="moderation_action",
        title=title,
        message=message,
        reference_type=target_type,
        reference_id=getattr(target_object, "id", None),
        action_url=action_url,
        icon="🛡️",
        commit=True,
    )