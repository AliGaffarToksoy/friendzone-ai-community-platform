"""
Social room routes for FriendZone.
"""

from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from backend.database.db_connection import db
from backend.models.community_model import Community, CommunityMember
from backend.models.event_model import Event
from backend.models.social_room_model import SocialRoom, SocialRoomParticipant
from backend.models.user_model import User
from backend.services.gamification_service import add_points
from backend.utils.helpers import error_response, success_response


social_room_bp = Blueprint("social_rooms", __name__)


VALID_ROOM_TYPES = {
    "casual",
    "language",
    "gaming",
    "study",
    "event",
    "voice",
    "meet",
}

VALID_ROOM_VISIBILITY = {
    "public",
    "community",
    "private",
}

VALID_MEETING_PROVIDERS = {
    "internal",
    "jitsi",
    "google_meet",
    "zoom",
    "livekit",
    "external",
}


def get_current_user_id() -> int:
    """
    Return current authenticated user id.
    """

    return int(get_jwt_identity())


def parse_datetime(value: str | None) -> datetime | None:
    """
    Parse ISO-like datetime string.
    """

    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def get_user_membership(user_id: int, community_id: int) -> CommunityMember | None:
    """
    Return active community membership.
    """

    return CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()


def user_is_community_member(user_id: int, community_id: int) -> bool:
    """
    Check whether user is active community member.
    """

    return get_user_membership(user_id, community_id) is not None


def user_can_manage_community(user_id: int, community_id: int) -> bool:
    """
    Admins and moderators can manage community rooms.
    """

    membership = get_user_membership(user_id, community_id)

    if not membership:
        return False

    return membership.role in {"admin", "moderator"}


def user_can_view_room(user_id: int, room: SocialRoom) -> bool:
    """
    Determine whether user can view a room.
    """

    if not room.is_active:
        return False

    if room.visibility == "public":
        return True

    if room.visibility == "community" and room.community_id:
        return user_is_community_member(user_id, room.community_id)

    if room.visibility == "private":
        if room.created_by == user_id:
            return True

        participant = SocialRoomParticipant.query.filter_by(
            room_id=room.id,
            user_id=user_id,
            status="joined",
        ).first()

        return participant is not None

    return False


def user_can_manage_room(user_id: int, room: SocialRoom) -> bool:
    """
    Room creator or community admin/moderator can manage room.
    """

    if room.created_by == user_id:
        return True

    if room.community_id:
        return user_can_manage_community(user_id, room.community_id)

    return False


def get_viewer_status(room_id: int, user_id: int) -> str | None:
    """
    Return current viewer room status.
    """

    participant = SocialRoomParticipant.query.filter_by(
        room_id=room_id,
        user_id=user_id,
    ).first()

    return participant.status if participant else None


def refresh_room_count(room: SocialRoom) -> None:
    """
    Refresh current participant count and live state.
    """

    count = SocialRoomParticipant.query.filter_by(
        room_id=room.id,
        status="joined",
    ).count()

    room.current_participants = count
    room.is_live = count > 0
    room.last_activity_at = datetime.utcnow()


def serialize_room(room: SocialRoom, viewer_id: int) -> dict:
    """
    Serialize social room with related names.
    """

    creator = User.query.get(room.created_by)

    community = None
    if room.community_id:
        community = Community.query.get(room.community_id)

    event = None
    if room.event_id:
        event = Event.query.get(room.event_id)

    data = room.to_dict(
        creator_name=creator.name if creator else None,
        community_name=community.name if community else None,
        event_title=event.title if event else None,
        viewer_status=get_viewer_status(room.id, viewer_id),
    )

    data["can_manage_room"] = user_can_manage_room(viewer_id, room)

    return data


def serialize_participant(participant: SocialRoomParticipant) -> dict:
    """
    Serialize participant with user.
    """

    user = User.query.get(participant.user_id)

    return participant.to_dict(user=user)


@social_room_bp.route("", methods=["GET"])
@jwt_required()
def list_rooms() -> tuple:
    """
    List social rooms.

    Query params:
    - scope: all | joined | created | public
    - room_type
    - community_id
    - event_id
    - live=true
    """

    user_id = get_current_user_id()

    scope = request.args.get("scope", "all")
    room_type = request.args.get("room_type")
    community_id = request.args.get("community_id")
    event_id = request.args.get("event_id")
    live = request.args.get("live")

    query = SocialRoom.query.filter_by(is_active=True)

    if room_type:
        query = query.filter(SocialRoom.room_type == room_type)

    if community_id:
        query = query.filter(SocialRoom.community_id == int(community_id))

    if event_id:
        query = query.filter(SocialRoom.event_id == int(event_id))

    if live is not None:
        is_live = str(live).lower() in {"true", "1", "yes"}
        query = query.filter(SocialRoom.is_live == is_live)

    if scope == "joined":
        joined_room_ids = [
            participant.room_id
            for participant in SocialRoomParticipant.query.filter_by(
                user_id=user_id,
                status="joined",
            ).all()
        ]

        query = query.filter(SocialRoom.id.in_(joined_room_ids) if joined_room_ids else False)

    elif scope == "created":
        query = query.filter(SocialRoom.created_by == user_id)

    elif scope == "public":
        query = query.filter(SocialRoom.visibility == "public")

    else:
        memberships = CommunityMember.query.filter_by(
            user_id=user_id,
            is_active=True,
        ).all()

        community_ids = [membership.community_id for membership in memberships]

        query = query.filter(
            or_(
                SocialRoom.visibility == "public",
                SocialRoom.created_by == user_id,
                SocialRoom.community_id.in_(community_ids) if community_ids else False,
            )
        )

    rooms = (
        query
        .order_by(
            SocialRoom.is_featured.desc(),
            SocialRoom.is_live.desc(),
            SocialRoom.last_activity_at.desc(),
            SocialRoom.created_at.desc(),
        )
        .all()
    )

    data = [
        serialize_room(room, viewer_id=user_id)
        for room in rooms
        if user_can_view_room(user_id, room)
    ]

    return success_response("Sosyal odalar getirildi.", data)


@social_room_bp.route("/community/<int:community_id>", methods=["GET"])
@jwt_required()
def list_community_rooms(community_id: int) -> tuple:
    """
    List rooms for a community.
    """

    user_id = get_current_user_id()

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, community.id):
        return error_response("Topluluk odalarını görmek için topluluğa üye olmalısınız.", status_code=403)

    rooms = (
        SocialRoom.query
        .filter_by(community_id=community.id, is_active=True)
        .order_by(
            SocialRoom.is_featured.desc(),
            SocialRoom.is_live.desc(),
            SocialRoom.last_activity_at.desc(),
        )
        .all()
    )

    data = [
        serialize_room(room, viewer_id=user_id)
        for room in rooms
    ]

    return success_response("Topluluk odaları getirildi.", data)


@social_room_bp.route("/<int:room_id>", methods=["GET"])
@jwt_required()
def get_room(room_id: int) -> tuple:
    """
    Return room detail.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not user_can_view_room(user_id, room):
        return error_response("Oda bulunamadı.", status_code=404)

    return success_response("Oda detayı getirildi.", serialize_room(room, viewer_id=user_id))


@social_room_bp.route("/create", methods=["POST"])
@jwt_required()
def create_room() -> tuple:
    """
    Create social room.
    """

    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    room_type = str(data.get("room_type", "casual")).strip()
    visibility = str(data.get("visibility", "community")).strip()

    community_id = data.get("community_id")
    event_id = data.get("event_id")

    max_participants = data.get("max_participants", 20)
    meeting_provider = str(data.get("meeting_provider", "")).strip() or None
    meeting_url = str(data.get("meeting_url", "")).strip() or None
    language = str(data.get("language", "")).strip() or None
    game_title = str(data.get("game_title", "")).strip() or None

    scheduled_start = parse_datetime(data.get("scheduled_start"))
    scheduled_end = parse_datetime(data.get("scheduled_end"))

    if not name or len(name) < 3:
        return error_response("Oda adı en az 3 karakter olmalıdır.")

    if len(name) > 160:
        return error_response("Oda adı en fazla 160 karakter olabilir.")

    if description and len(description) > 1500:
        return error_response("Oda açıklaması en fazla 1500 karakter olabilir.")

    if room_type not in VALID_ROOM_TYPES:
        return error_response("Geçersiz oda tipi.")

    if visibility not in VALID_ROOM_VISIBILITY:
        return error_response("Geçersiz görünürlük tipi.")

    if meeting_provider and meeting_provider not in VALID_MEETING_PROVIDERS:
        return error_response("Geçersiz toplantı sağlayıcısı.")

    try:
        max_participants = int(max_participants)
    except Exception:
        max_participants = 20

    max_participants = max(2, min(500, max_participants))

    community = None

    if community_id:
        community = Community.query.get(int(community_id))

        if not community or not community.is_active:
            return error_response("Topluluk bulunamadı.", status_code=404)

        if not user_is_community_member(user_id, community.id):
            return error_response("Topluluk odası oluşturmak için topluluğa üye olmalısınız.", status_code=403)

        visibility = "community"

    event = None

    if event_id:
        event = Event.query.get(int(event_id))

        if not event or not event.is_active:
            return error_response("Etkinlik bulunamadı.", status_code=404)

        if not user_is_community_member(user_id, event.community_id):
            return error_response("Etkinlik odası oluşturmak için ilgili topluluğa üye olmalısınız.", status_code=403)

        community_id = event.community_id
        room_type = "event"
        visibility = "community"

    room = SocialRoom(
        community_id=int(community_id) if community_id else None,
        event_id=int(event_id) if event_id else None,
        created_by=user_id,
        name=name,
        description=description or None,
        room_type=room_type,
        visibility=visibility,
        max_participants=max_participants,
        current_participants=0,
        is_active=True,
        is_live=False,
        is_featured=False,
        meeting_provider=meeting_provider,
        meeting_url=meeting_url,
        language=language,
        game_title=game_title,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        last_activity_at=datetime.utcnow(),
    )

    db.session.add(room)
    db.session.commit()

    add_points(
        user_id=user_id,
        action_type="social_room_created",
        points=10,
        description="Sosyal oda oluşturdu.",
        reference_type="social_room",
        reference_id=room.id,
        allow_duplicate=False,
    )

    return success_response("Sosyal oda oluşturuldu.", serialize_room(room, viewer_id=user_id), status_code=201)


@social_room_bp.route("/<int:room_id>/join", methods=["POST"])
@jwt_required()
def join_room(room_id: int) -> tuple:
    """
    Join social room.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not user_can_view_room(user_id, room):
        return error_response("Oda bulunamadı.", status_code=404)

    active_count = SocialRoomParticipant.query.filter_by(
        room_id=room.id,
        status="joined",
    ).count()

    existing = SocialRoomParticipant.query.filter_by(
        room_id=room.id,
        user_id=user_id,
    ).first()

    already_joined = existing and existing.status == "joined"

    if not already_joined and room.max_participants and active_count >= room.max_participants:
        return error_response("Oda maksimum katılımcı sayısına ulaşmış.", status_code=409)

    joined_now = False

    if existing:
        if existing.status != "joined":
            existing.status = "joined"
            existing.left_at = None
            existing.last_seen_at = datetime.utcnow()
            joined_now = True
    else:
        participant = SocialRoomParticipant(
            room_id=room.id,
            user_id=user_id,
            status="joined",
            role="host" if room.created_by == user_id else "participant",
            last_seen_at=datetime.utcnow(),
        )
        db.session.add(participant)
        joined_now = True

    refresh_room_count(room)
    db.session.commit()

    if joined_now:
        add_points(
            user_id=user_id,
            action_type="social_room_joined",
            points=5,
            description="Sosyal odaya katıldı.",
            reference_type="social_room",
            reference_id=room.id,
            allow_duplicate=False,
        )

    return success_response("Odaya katıldınız.", serialize_room(room, viewer_id=user_id))


@social_room_bp.route("/<int:room_id>/leave", methods=["POST"])
@jwt_required()
def leave_room(room_id: int) -> tuple:
    """
    Leave social room.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not room.is_active:
        return error_response("Oda bulunamadı.", status_code=404)

    participant = SocialRoomParticipant.query.filter_by(
        room_id=room.id,
        user_id=user_id,
    ).first()

    if not participant or participant.status != "joined":
        return error_response("Bu odada aktif değilsiniz.", status_code=404)

    participant.status = "left"
    participant.left_at = datetime.utcnow()
    participant.last_seen_at = datetime.utcnow()

    refresh_room_count(room)
    db.session.commit()

    return success_response("Odadan ayrıldınız.", serialize_room(room, viewer_id=user_id))


@social_room_bp.route("/<int:room_id>/participants", methods=["GET"])
@jwt_required()
def list_room_participants(room_id: int) -> tuple:
    """
    List active room participants.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not user_can_view_room(user_id, room):
        return error_response("Oda bulunamadı.", status_code=404)

    participants = (
        SocialRoomParticipant.query
        .filter_by(room_id=room.id, status="joined")
        .order_by(SocialRoomParticipant.joined_at.asc())
        .all()
    )

    data = [
        serialize_participant(participant)
        for participant in participants
    ]

    return success_response("Oda katılımcıları getirildi.", data)


@social_room_bp.route("/<int:room_id>", methods=["PATCH"])
@jwt_required()
def update_room(room_id: int) -> tuple:
    """
    Update social room.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not room.is_active:
        return error_response("Oda bulunamadı.", status_code=404)

    if not user_can_manage_room(user_id, room):
        return error_response("Bu odayı düzenleme yetkiniz yok.", status_code=403)

    data = request.get_json(silent=True) or {}

    name = str(data.get("name", room.name)).strip()
    description = str(data.get("description", room.description or "")).strip()
    room_type = str(data.get("room_type", room.room_type)).strip()
    visibility = str(data.get("visibility", room.visibility)).strip()
    max_participants = data.get("max_participants", room.max_participants)
    meeting_provider = str(data.get("meeting_provider", room.meeting_provider or "")).strip() or None
    meeting_url = str(data.get("meeting_url", room.meeting_url or "")).strip() or None
    language = str(data.get("language", room.language or "")).strip() or None
    game_title = str(data.get("game_title", room.game_title or "")).strip() or None
    scheduled_start = parse_datetime(data.get("scheduled_start")) or room.scheduled_start
    scheduled_end = parse_datetime(data.get("scheduled_end")) or room.scheduled_end
    is_featured = bool(data.get("is_featured", room.is_featured))

    if not name or len(name) < 3:
        return error_response("Oda adı en az 3 karakter olmalıdır.")

    if room_type not in VALID_ROOM_TYPES:
        return error_response("Geçersiz oda tipi.")

    if visibility not in VALID_ROOM_VISIBILITY:
        return error_response("Geçersiz görünürlük tipi.")

    try:
        max_participants = int(max_participants)
    except Exception:
        max_participants = room.max_participants

    max_participants = max(2, min(500, max_participants))

    room.name = name
    room.description = description or None
    room.room_type = room_type
    room.visibility = visibility
    room.max_participants = max_participants
    room.meeting_provider = meeting_provider
    room.meeting_url = meeting_url
    room.language = language
    room.game_title = game_title
    room.scheduled_start = scheduled_start
    room.scheduled_end = scheduled_end
    room.is_featured = is_featured
    room.last_activity_at = datetime.utcnow()

    db.session.commit()

    return success_response("Sosyal oda güncellendi.", serialize_room(room, viewer_id=user_id))


@social_room_bp.route("/<int:room_id>", methods=["DELETE"])
@jwt_required()
def delete_room(room_id: int) -> tuple:
    """
    Soft-delete social room.
    """

    user_id = get_current_user_id()

    room = SocialRoom.query.get(room_id)

    if not room or not room.is_active:
        return error_response("Oda bulunamadı.", status_code=404)

    if not user_can_manage_room(user_id, room):
        return error_response("Bu odayı silme yetkiniz yok.", status_code=403)

    room.is_active = False
    room.is_live = False

    SocialRoomParticipant.query.filter_by(room_id=room.id, status="joined").update({
        "status": "left",
        "left_at": datetime.utcnow(),
        "last_seen_at": datetime.utcnow(),
    })

    db.session.commit()

    return success_response("Sosyal oda silindi.", {
        "room_id": room.id,
        "is_active": room.is_active,
    })