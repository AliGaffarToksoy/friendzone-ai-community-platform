"""
Event routes for FriendZone.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func
from werkzeug.utils import secure_filename

from backend.database.db_connection import db
from backend.models.community_model import Community, CommunityMember
from backend.models.event_model import Event, EventParticipant, EventReview
from backend.models.user_model import User
from backend.services.gamification_service import add_points
from backend.utils.helpers import error_response, success_response
from backend.services.notification_service import create_unique_notification, notify_community_members


event_bp = Blueprint("events", __name__)


ALLOWED_POSTER_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_POSTER_SIZE_MB = 6
VALID_EVENT_TYPES = {"offline", "online", "hybrid"}
VALID_PARTICIPATION_STATUSES = {"going", "interested", "cancelled"}


def get_event_upload_root() -> Path:
    root = Path(current_app.root_path) / "uploads" / "event_posters"
    root.mkdir(parents=True, exist_ok=True)
    return root


def is_allowed_poster(filename: str) -> bool:
    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_POSTER_EXTENSIONS


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def user_is_community_member(user_id: int, community_id: int) -> bool:
    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()

    return membership is not None


def get_user_membership(user_id: int, community_id: int) -> CommunityMember | None:
    return CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()


def user_can_manage_community(user_id: int, community_id: int) -> bool:
    membership = get_user_membership(user_id, community_id)

    if not membership:
        return False

    return membership.role in {"admin", "moderator"}


def user_can_view_event_participants(user_id: int, community_id: int) -> bool:
    return user_can_manage_community(user_id, community_id)


def get_participant_count(event_id: int) -> int:
    return EventParticipant.query.filter(
        EventParticipant.event_id == event_id,
        EventParticipant.status.in_(["going", "interested"]),
    ).count()


def get_user_event_status(event_id: int, user_id: int | None) -> str | None:
    if not user_id:
        return None

    participant = EventParticipant.query.filter_by(
        event_id=event_id,
        user_id=user_id,
    ).first()

    return participant.status if participant else None


def get_average_rating(event_id: int) -> tuple[float | None, int]:
    result = db.session.query(
        func.avg(EventReview.rating),
        func.count(EventReview.id),
    ).filter(EventReview.event_id == event_id).first()

    average = result[0]
    count = result[1] or 0

    return (round(float(average), 1) if average is not None else None, count)


def serialize_event(event: Event, user_id: int | None = None) -> dict:
    average_rating, review_count = get_average_rating(event.id)

    data = event.to_dict(
        participant_count=get_participant_count(event.id),
        user_status=get_user_event_status(event.id, user_id),
        average_rating=average_rating,
        review_count=review_count,
    )

    data["can_manage_event"] = bool(
        user_id and user_can_manage_community(user_id, event.community_id)
    )

    data["can_view_participants"] = bool(
        user_id and user_can_view_event_participants(user_id, event.community_id)
    )

    return data


def serialize_participant(participant: EventParticipant) -> dict:
    user = User.query.get(participant.user_id)

    return {
        "id": participant.id,
        "event_id": participant.event_id,
        "user_id": participant.user_id,
        "status": participant.status,
        "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "profile_image": getattr(user, "profile_image", None),
            "university": getattr(user, "university", None),
            "department": getattr(user, "department", None),
            "city": getattr(user, "city", None),
        } if user else None,
    }


def save_poster_from_request() -> str | None:
    if "poster" not in request.files:
        return None

    file = request.files["poster"]

    if not file or file.filename == "":
        return None

    if not is_allowed_poster(file.filename):
        raise ValueError("Sadece png, jpg, jpeg veya webp poster görselleri kabul edilir.")

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    max_size_bytes = MAX_POSTER_SIZE_MB * 1024 * 1024

    if file_size > max_size_bytes:
        raise ValueError(f"Poster görseli en fazla {MAX_POSTER_SIZE_MB}MB olabilir.")

    upload_root = get_event_upload_root()

    original_name = secure_filename(file.filename)
    extension = original_name.rsplit(".", 1)[1].lower()
    filename = f"event_{uuid.uuid4().hex}.{extension}"

    file.save(upload_root / filename)

    return filename


@event_bp.route("", methods=["GET"])
@jwt_required()
def list_events() -> tuple:
    user_id = int(get_jwt_identity())

    query = Event.query.filter_by(is_active=True)

    community_id = request.args.get("community_id")
    city = request.args.get("city")
    event_type = request.args.get("event_type")

    if community_id:
        query = query.filter(Event.community_id == int(community_id))

    if city:
        query = query.filter(func.lower(Event.city) == city.lower())

    if event_type:
        query = query.filter(Event.event_type == event_type)

    events = query.order_by(Event.event_date.asc()).all()

    data = [
        serialize_event(event, user_id=user_id)
        for event in events
    ]

    return success_response("Etkinlikler getirildi.", data)


@event_bp.route("/community/<int:community_id>", methods=["GET"])
@jwt_required()
def list_community_events(community_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, community_id):
        return error_response("Bu topluluğun etkinliklerini görmek için topluluğa üye olmalısınız.", status_code=403)

    events = (
        Event.query
        .filter_by(community_id=community_id, is_active=True)
        .order_by(Event.event_date.asc())
        .all()
    )

    data = [
        serialize_event(event, user_id=user_id)
        for event in events
    ]

    return success_response("Topluluk etkinlikleri getirildi.", data)


@event_bp.route("/<int:event_id>", methods=["GET"])
@jwt_required()
def get_event(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, event.community_id):
        return error_response("Bu etkinliği görüntülemek için topluluğa üye olmalısınız.", status_code=403)

    return success_response("Etkinlik detayı getirildi.", serialize_event(event, user_id=user_id))


@event_bp.route("/create", methods=["POST"])
@jwt_required()
def create_event() -> tuple:
    user_id = int(get_jwt_identity())

    community_id = request.form.get("community_id")

    if not community_id:
        return error_response("Topluluk ID zorunludur.")

    try:
        community_id = int(community_id)
    except Exception:
        return error_response("Geçerli bir topluluk ID girilmelidir.")

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_can_manage_community(user_id, community.id):
        return error_response("Etkinlik oluşturmak için topluluk admini veya moderatörü olmalısınız.", status_code=403)

    title = str(request.form.get("title", "")).strip()
    description = str(request.form.get("description", "")).strip()
    event_type = str(request.form.get("event_type", "offline")).strip()
    city = str(request.form.get("city", "")).strip()
    location = str(request.form.get("location", "")).strip()
    event_date = parse_datetime(request.form.get("event_date"))
    capacity_raw = request.form.get("capacity")

    if not title or len(title) < 3:
        return error_response("Etkinlik başlığı en az 3 karakter olmalıdır.")

    if not description or len(description) < 20:
        return error_response("Etkinlik açıklaması en az 20 karakter olmalıdır.")

    if event_type not in VALID_EVENT_TYPES:
        return error_response("Geçersiz etkinlik tipi.")

    if event_type in {"offline", "hybrid"} and not location:
        return error_response("Yüz yüze veya hibrit etkinliklerde konum zorunludur.")

    if not event_date:
        return error_response("Geçerli bir etkinlik tarihi girmelisiniz.")

    capacity = None

    if capacity_raw:
        try:
            capacity = int(capacity_raw)
            capacity = max(1, min(5000, capacity))
        except Exception:
            capacity = None

    poster_filename = None

    try:
        poster_filename = save_poster_from_request()
    except ValueError as exc:
        return error_response(str(exc))

    event = Event(
        community_id=community.id,
        title=title,
        description=description,
        event_type=event_type,
        city=city or community.city,
        location=location or None,
        event_date=event_date,
        poster_image=poster_filename,
        capacity=capacity,
        created_by=user_id,
        is_active=True,
    )

    db.session.add(event)
    db.session.commit()

    add_points(
        user_id=user_id,
        action_type="event_created",
        description="Topluluk etkinliği oluşturdu.",
        reference_type="event",
        reference_id=event.id,
        allow_duplicate=False,
    )

    notify_community_members(
        community_id=event.community_id,
        notification_type="event_created",
        title="Toplulukta yeni etkinlik oluşturuldu",
        message=f"{event.title} etkinliği toplulukta yayınlandı.",
        reference_type="event",
        reference_id=event.id,
        action_url=f"community.html?id={event.community_id}",
        icon="📅",
        exclude_user_ids=[user_id],
        unique=False,
        commit=True,
    )

    return success_response("Etkinlik oluşturuldu.", serialize_event(event, user_id=user_id), status_code=201)


@event_bp.route("/<int:event_id>", methods=["PATCH"])
@jwt_required()
def update_event(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_can_manage_community(user_id, event.community_id):
        return error_response("Bu etkinliği düzenleme yetkiniz yok.", status_code=403)

    title = str(request.form.get("title", event.title)).strip()
    description = str(request.form.get("description", event.description)).strip()
    event_type = str(request.form.get("event_type", event.event_type)).strip()
    city = str(request.form.get("city", event.city or "")).strip()
    location = str(request.form.get("location", event.location or "")).strip()
    event_date = parse_datetime(request.form.get("event_date")) or event.event_date
    capacity_raw = request.form.get("capacity")

    if not title or len(title) < 3:
        return error_response("Etkinlik başlığı en az 3 karakter olmalıdır.")

    if not description or len(description) < 20:
        return error_response("Etkinlik açıklaması en az 20 karakter olmalıdır.")

    if event_type not in VALID_EVENT_TYPES:
        return error_response("Geçersiz etkinlik tipi.")

    if event_type in {"offline", "hybrid"} and not location:
        return error_response("Yüz yüze veya hibrit etkinliklerde konum zorunludur.")

    capacity = None

    if capacity_raw:
        try:
            capacity = int(capacity_raw)
            capacity = max(1, min(5000, capacity))
        except Exception:
            capacity = event.capacity

    poster_filename = event.poster_image

    try:
        new_poster = save_poster_from_request()
        if new_poster:
            poster_filename = new_poster
    except ValueError as exc:
        return error_response(str(exc))

    event.title = title
    event.description = description
    event.event_type = event_type
    event.city = city or None
    event.location = location or None
    event.event_date = event_date
    event.capacity = capacity
    event.poster_image = poster_filename

    db.session.commit()

    return success_response("Etkinlik güncellendi.", serialize_event(event, user_id=user_id))


@event_bp.route("/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_can_manage_community(user_id, event.community_id):
        return error_response("Bu etkinliği silme yetkiniz yok.", status_code=403)

    event.is_active = False
    db.session.commit()

    return success_response("Etkinlik silindi.", {
        "event_id": event.id,
        "is_active": event.is_active,
    })


@event_bp.route("/<int:event_id>/participants", methods=["GET"])
@jwt_required()
def list_event_participants(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_can_view_event_participants(user_id, event.community_id):
        return error_response("Katılımcıları görüntüleme yetkiniz yok.", status_code=403)

    participants = (
        EventParticipant.query
        .filter(
            EventParticipant.event_id == event.id,
            EventParticipant.status.in_(["going", "interested"]),
        )
        .order_by(EventParticipant.joined_at.desc())
        .all()
    )

    data = [serialize_participant(participant) for participant in participants]

    return success_response("Etkinlik katılımcıları getirildi.", data)


@event_bp.route("/<int:event_id>/join", methods=["POST"])
@jwt_required()
def join_event(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    status = str(data.get("status", "going")).strip()

    if status not in VALID_PARTICIPATION_STATUSES:
        return error_response("Geçersiz katılım durumu.")

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, event.community_id):
        return error_response("Etkinliğe katılmak için ilgili topluluğa üye olmalısınız.", status_code=403)

    if status in {"going", "interested"} and event.capacity:
        current_count = EventParticipant.query.filter_by(
            event_id=event.id,
            status="going",
        ).count()

        existing = EventParticipant.query.filter_by(
            event_id=event.id,
            user_id=user_id,
        ).first()

        existing_is_going = existing and existing.status == "going"

        if status == "going" and not existing_is_going and current_count >= event.capacity:
            return error_response("Etkinlik kapasitesi dolmuş.", status_code=409)

    participant = EventParticipant.query.filter_by(
        event_id=event.id,
        user_id=user_id,
    ).first()

    was_new_participation = False

    if participant:
        old_status = participant.status
        participant.status = status

        if old_status == "cancelled" and status in {"going", "interested"}:
            was_new_participation = True
    else:
        participant = EventParticipant(
            event_id=event.id,
            user_id=user_id,
            status=status,
        )
        db.session.add(participant)

        if status in {"going", "interested"}:
            was_new_participation = True

    db.session.commit()

    if was_new_participation:
        add_points(
            user_id=user_id,
            action_type="event_joined",
            description="Bir etkinliğe katılım gösterdi.",
            reference_type="event",
            reference_id=event.id,
            allow_duplicate=False,
        )

        actor = User.query.get(user_id)
        actor_name = actor.name if actor else "Bir kullanıcı"

        if event.created_by and event.created_by != user_id:
            create_unique_notification(
                user_id=event.created_by,
                notification_type="event_joined",
                title="Etkinliğine yeni katılımcı geldi",
                message=f"{actor_name} kullanıcısı {event.title} etkinliğine katıldı.",
                reference_type="event",
                reference_id=event.id,
                action_url=f"community.html?id={event.community_id}",
                icon="✅",
                commit=True,
            )

    return success_response("Etkinlik katılım durumu güncellendi.", serialize_event(event, user_id=user_id))


@event_bp.route("/<int:event_id>/reviews", methods=["GET"])
@jwt_required()
def list_event_reviews(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, event.community_id):
        return error_response("Yorumları görmek için topluluğa üye olmalısınız.", status_code=403)

    reviews = (
        EventReview.query
        .filter_by(event_id=event.id)
        .order_by(EventReview.created_at.desc())
        .all()
    )

    data = []

    for review in reviews:
        user = User.query.get(review.user_id)
        data.append(review.to_dict(user_name=user.name if user else None))

    return success_response("Etkinlik yorumları getirildi.", data)


@event_bp.route("/<int:event_id>/reviews", methods=["POST"])
@jwt_required()
def create_or_update_review(event_id: int) -> tuple:
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, event.community_id):
        return error_response("Yorum yapmak için topluluğa üye olmalısınız.", status_code=403)

    rating = data.get("rating")
    comment = str(data.get("comment", "")).strip()

    try:
        rating = int(rating)
    except Exception:
        return error_response("Geçerli bir puan girmelisiniz.")

    if rating < 1 or rating > 5:
        return error_response("Puan 1 ile 5 arasında olmalıdır.")

    if len(comment) > 800:
        return error_response("Yorum en fazla 800 karakter olabilir.")

    review = EventReview.query.filter_by(
        event_id=event.id,
        user_id=user_id,
    ).first()

    is_new_review = False

    if review:
        review.rating = rating
        review.comment = comment or None
    else:
        review = EventReview(
            event_id=event.id,
            user_id=user_id,
            rating=rating,
            comment=comment or None,
        )
        db.session.add(review)
        is_new_review = True

    db.session.commit()

    user = User.query.get(user_id)
    actor_name = user.name if user else "Bir kullanıcı"

    if is_new_review:
        add_points(
            user_id=user_id,
            action_type="event_review_created",
            description="Etkinlik değerlendirmesi yaptı.",
            reference_type="event_review",
            reference_id=review.id,
            allow_duplicate=False,
        )

        if event.created_by and event.created_by != user_id:
            create_unique_notification(
                user_id=event.created_by,
                notification_type="event_review_created",
                title="Etkinliğine yeni değerlendirme geldi",
                message=f"{actor_name} kullanıcısı {event.title} etkinliğini değerlendirdi.",
                reference_type="event_review",
                reference_id=review.id,
                action_url=f"community.html?id={event.community_id}",
                icon="💬",
                commit=True,
            )

    user = User.query.get(user_id)

    return success_response(
        "Etkinlik değerlendirmesi kaydedildi.",
        review.to_dict(user_name=user.name if user else None),
    )