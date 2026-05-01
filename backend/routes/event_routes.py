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
from backend.utils.helpers import error_response, success_response


event_bp = Blueprint("events", __name__)


ALLOWED_POSTER_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_POSTER_SIZE_MB = 6
VALID_EVENT_TYPES = {"offline", "online", "hybrid"}
VALID_PARTICIPATION_STATUSES = {"going", "interested", "cancelled"}


def get_event_upload_root() -> Path:
    """
    Return event poster upload directory.
    """

    root = Path(current_app.root_path) / "uploads" / "event_posters"
    root.mkdir(parents=True, exist_ok=True)
    return root


def is_allowed_poster(filename: str) -> bool:
    """
    Validate poster image extension.
    """

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_POSTER_EXTENSIONS


def parse_datetime(value: str | None) -> datetime | None:
    """
    Parse ISO-like datetime string from frontend.
    """

    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def user_is_community_member(user_id: int, community_id: int) -> bool:
    """
    Check whether user is active member of a community.
    """

    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()

    return membership is not None


def user_can_manage_community(user_id: int, community_id: int) -> bool:
    """
    Community admins and moderators can create events.
    """

    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()

    if not membership:
        return False

    return membership.role in {"admin", "moderator"}


def get_participant_count(event_id: int) -> int:
    """
    Count active participants.
    """

    return EventParticipant.query.filter(
        EventParticipant.event_id == event_id,
        EventParticipant.status.in_(["going", "interested"]),
    ).count()


def get_user_event_status(event_id: int, user_id: int | None) -> str | None:
    """
    Return current user's event status.
    """

    if not user_id:
        return None

    participant = EventParticipant.query.filter_by(
        event_id=event_id,
        user_id=user_id,
    ).first()

    return participant.status if participant else None


def get_average_rating(event_id: int) -> tuple[float | None, int]:
    """
    Return average rating and review count.
    """

    result = db.session.query(
        func.avg(EventReview.rating),
        func.count(EventReview.id),
    ).filter(EventReview.event_id == event_id).first()

    average = result[0]
    count = result[1] or 0

    return (round(float(average), 1) if average is not None else None, count)


def serialize_event(event: Event, user_id: int | None = None) -> dict:
    """
    Serialize event with computed statistics.
    """

    average_rating, review_count = get_average_rating(event.id)

    return event.to_dict(
        participant_count=get_participant_count(event.id),
        user_status=get_user_event_status(event.id, user_id),
        average_rating=average_rating,
        review_count=review_count,
    )


def save_poster_from_request() -> str | None:
    """
    Save uploaded poster image if present.
    """

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
    """
    List active events.

    Optional query params:
    - community_id
    - city
    - event_type
    """

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
    """
    List active events for a specific community.
    """

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
    """
    Return event detail.
    """

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
    """
    Create a new community event.

    Accepts multipart/form-data:
    - community_id
    - title
    - description
    - event_type
    - city
    - location
    - event_date
    - capacity
    - poster
    """

    user_id = int(get_jwt_identity())

    community_id = request.form.get("community_id")

    if not community_id:
        return error_response("Topluluk ID zorunludur.")

    community = Community.query.get(int(community_id))

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

    return success_response("Etkinlik oluşturuldu.", serialize_event(event, user_id=user_id), status_code=201)


@event_bp.route("/<int:event_id>/join", methods=["POST"])
@jwt_required()
def join_event(event_id: int) -> tuple:
    """
    Join or update event participation status.
    """

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

    if participant:
        participant.status = status
    else:
        participant = EventParticipant(
            event_id=event.id,
            user_id=user_id,
            status=status,
        )
        db.session.add(participant)

    db.session.commit()

    return success_response("Etkinlik katılım durumu güncellendi.", serialize_event(event, user_id=user_id))


@event_bp.route("/<int:event_id>/reviews", methods=["GET"])
@jwt_required()
def list_event_reviews(event_id: int) -> tuple:
    """
    List event reviews.
    """

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
    """
    Create or update event review.
    """

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

    db.session.commit()

    user = User.query.get(user_id)

    return success_response(
        "Etkinlik değerlendirmesi kaydedildi.",
        review.to_dict(user_name=user.name if user else None),
    )