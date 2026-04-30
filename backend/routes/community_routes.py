"""
Community routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.database.db_connection import db
from backend.models.chat_room_model import ChatRoom
from backend.models.community_model import Community, CommunityMember
from backend.models.user_model import User
from backend.services.recommendation_service import get_recommended_communities
from backend.utils.helpers import error_response, success_response


community_bp = Blueprint("community", __name__)


VALID_SCOPES = {"university", "city", "country", "online"}


def ensure_chat_room_for_community(community: Community) -> ChatRoom:
    """
    Ensure that a community has exactly one active chat room.
    """

    room = ChatRoom.query.filter_by(community_id=community.id).first()

    if room:
        room.is_active = True
        room.name = f"{community.name} Sohbet Odası"
        room.description = f"{community.name} topluluğu için ana sohbet odası."
        room.max_members = community.max_members
        db.session.commit()
        return room

    room = ChatRoom(
        community_id=community.id,
        name=f"{community.name} Sohbet Odası",
        description=f"{community.name} topluluğu için ana sohbet odası.",
        is_active=True,
        max_members=community.max_members,
        current_members=0,
        settings={
            "allow_reactions": True,
            "allow_typing_indicator": True,
            "message_history_limit": 50,
        },
    )

    db.session.add(room)
    db.session.commit()

    return room


def normalize_text(value: str | None) -> str:
    """
    Normalize Turkish text for safer filtering.
    """

    if not value:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("ı", "i")
        .replace("İ", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
    )


def get_member_count(community_id: int) -> int:
    """
    Return active member count for a community.
    """

    return CommunityMember.query.filter_by(
        community_id=community_id,
        is_active=True,
    ).count()


def serialize_community(community: Community, score: float | None = None) -> dict:
    """
    Serialize a community with member count.
    """

    return community.to_dict(
        member_count=get_member_count(community.id),
        compatibility_score=score,
    )


def is_community_visible_for_user(community: Community, user: User | None) -> bool:
    """
    Determine whether a community should be visible to the user.

    Visibility behavior:
    - Not logged in: show country and online communities.
    - User scope university: show same university + country + online.
    - User scope city: show same city + country + online.
    - User scope country: show all active communities.
    """

    if not community.is_active:
        return False

    community_scope = community.scope or "country"

    if community_scope in {"country", "online"}:
        return True

    if user is None:
        return False

    user_scope = user.visibility_scope or "university"

    if user_scope == "country":
        return True

    if user_scope == "city":
        if community_scope == "city":
            return normalize_text(community.city) == normalize_text(user.city)

        if community_scope == "university":
            return (
                normalize_text(community.city) == normalize_text(user.city)
                or normalize_text(community.university) == normalize_text(user.university)
            )

    if user_scope == "university":
        if community_scope == "university":
            return normalize_text(community.university) == normalize_text(user.university)

    return False


def filter_communities_for_user(communities: list[Community], user: User | None) -> list[Community]:
    """
    Filter communities according to user's discovery preference.
    """

    return [
        community
        for community in communities
        if is_community_visible_for_user(community, user)
    ]


def get_current_user_optional() -> User | None:
    """
    Return current user when JWT identity exists, otherwise None.
    """

    try:
        identity = get_jwt_identity()

        if not identity:
            return None

        return User.query.get(int(identity))
    except Exception:
        return None


@community_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def list_communities() -> tuple:
    """
    Return all active communities visible according to the user's discovery preference.
    """

    user = get_current_user_optional()

    communities = (
        Community.query
        .filter_by(is_active=True)
        .order_by(Community.created_at.desc())
        .all()
    )

    visible_communities = filter_communities_for_user(communities, user)

    data = []

    for community in visible_communities:
        ensure_chat_room_for_community(community)
        data.append(serialize_community(community))

    return success_response("Topluluklar getirildi.", data)


@community_bp.route("/recommendations/<int:user_id>", methods=["GET"])
@jwt_required()
def recommendations(user_id: int) -> tuple:
    """
    Return recommended communities for the user.
    """

    current_user_id = int(get_jwt_identity())

    if current_user_id != user_id:
        return error_response("Bu işlem için yetkiniz yok.", status_code=403)

    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    recommendation_items = get_recommended_communities(user, limit=12)

    data = []

    for item in recommendation_items:
        community = item.get("community") if isinstance(item, dict) else item
        score = item.get("score", 0) if isinstance(item, dict) else 0

        if not community:
            continue

        if not is_community_visible_for_user(community, user):
            continue

        ensure_chat_room_for_community(community)
        data.append(serialize_community(community, score=score))

    return success_response("Önerilen topluluklar getirildi.", data)


@community_bp.route("/user/<int:user_id>", methods=["GET"])
@jwt_required()
def user_communities(user_id: int) -> tuple:
    """
    Return communities that the user is actively a member of.
    """

    current_user_id = int(get_jwt_identity())

    if current_user_id != user_id:
        return error_response("Bu işlem için yetkiniz yok.", status_code=403)

    memberships = CommunityMember.query.filter_by(
        user_id=user_id,
        is_active=True,
    ).all()

    data = []

    for membership in memberships:
        community = membership.community

        if not community or not community.is_active:
            continue

        ensure_chat_room_for_community(community)

        item = serialize_community(community)
        item["role"] = membership.role
        item["joined_at"] = membership.joined_at.isoformat() if membership.joined_at else None

        data.append(item)

    return success_response("Kullanıcının toplulukları getirildi.", data)


@community_bp.route("/<int:community_id>", methods=["GET"])
@jwt_required()
def get_community(community_id: int) -> tuple:
    """
    Return community details.
    """

    user = User.query.get(int(get_jwt_identity()))
    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not is_community_visible_for_user(community, user):
        membership = CommunityMember.query.filter_by(
            user_id=user.id,
            community_id=community.id,
            is_active=True,
        ).first()

        if not membership:
            return error_response("Bu topluluğu görüntüleme yetkiniz yok.", status_code=403)

    room = ensure_chat_room_for_community(community)

    data = serialize_community(community)
    data["chat_room"] = {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "current_members": room.current_members,
        "max_members": room.max_members,
    }

    return success_response("Topluluk detayı getirildi.", data)


@community_bp.route("/join", methods=["POST"])
@jwt_required()
def join_community() -> tuple:
    """
    Join the current user to a community.
    """

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    data = request.get_json() or {}
    community_id = data.get("community_id")

    if not community_id:
        return error_response("Topluluk ID zorunludur.")

    community = Community.query.get(int(community_id))

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not is_community_visible_for_user(community, user):
        return error_response(
            "Bu topluluk mevcut keşif tercihinize uygun değil. Profil ayarlarından keşif kapsamınızı genişletebilirsiniz.",
            status_code=403,
        )

    active_member_count = get_member_count(community.id)

    if community.max_members and active_member_count >= community.max_members:
        return error_response("Topluluk maksimum üye sayısına ulaşmış.", status_code=409)

    existing = CommunityMember.query.filter_by(
        community_id=community.id,
        user_id=user_id,
    ).first()

    if existing:
        if existing.is_active:
            return success_response("Zaten bu topluluğa üyesiniz.", {
                "community_id": community.id,
                "community_name": community.name,
            })

        existing.is_active = True
        existing.role = existing.role or "member"
    else:
        membership = CommunityMember(
            community_id=community.id,
            user_id=user_id,
            role="member",
            is_active=True,
        )
        db.session.add(membership)

    room = ensure_chat_room_for_community(community)
    room.current_members = get_member_count(community.id)

    db.session.commit()

    return success_response("Topluluğa katıldınız.", {
        "community_id": community.id,
        "community_name": community.name,
        "chat_room_id": room.id,
    })


@community_bp.route("/create", methods=["POST"])
@jwt_required()
def create_community() -> tuple:
    """
    Create a new community and automatically create its chat room.
    """

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    data = request.get_json() or {}

    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    category = str(data.get("category", "")).strip()
    university = str(data.get("university", user.university or "")).strip()
    city = str(data.get("city", user.city or "")).strip()
    scope = str(data.get("scope", "university")).strip()
    tags = data.get("tags", [])
    max_members = data.get("max_members", 100)

    if not name or len(name) < 3:
        return error_response("Topluluk adı en az 3 karakter olmalıdır.")

    if not description or len(description) < 20:
        return error_response("Açıklama en az 20 karakter olmalıdır.")

    if not category:
        return error_response("Kategori zorunludur.")

    if scope not in VALID_SCOPES:
        return error_response("Geçersiz topluluk kapsamı.")

    if scope == "university" and not university:
        return error_response("Üniversite kapsamındaki topluluklar için üniversite bilgisi zorunludur.")

    if scope == "city" and not city:
        return error_response("Şehir kapsamındaki topluluklar için şehir bilgisi zorunludur.")

    if not isinstance(tags, list) or len(tags) < 2:
        return error_response("En az 2 etiket girmelisiniz.")

    cleaned_tags = []

    for tag in tags:
        tag_text = str(tag).strip()

        if tag_text and tag_text not in cleaned_tags:
            cleaned_tags.append(tag_text)

    existing = Community.query.filter_by(name=name).first()

    if existing:
        return error_response("Bu isimde bir topluluk zaten var.", status_code=409)

    try:
        max_members = int(max_members)
    except Exception:
        max_members = 100

    max_members = max(10, min(1000, max_members))

    community = Community(
        name=name,
        description=description,
        category=category,
        university=university or None,
        city=city or None,
        scope=scope,
        tags=cleaned_tags,
        max_members=max_members,
        is_active=True,
        created_by=user_id,
    )

    db.session.add(community)
    db.session.flush()

    membership = CommunityMember(
        community_id=community.id,
        user_id=user_id,
        role="admin",
        is_active=True,
    )

    db.session.add(membership)
    db.session.flush()

    room = ChatRoom(
        community_id=community.id,
        name=f"{community.name} Sohbet Odası",
        description=f"{community.name} topluluğu için ana sohbet odası.",
        is_active=True,
        max_members=community.max_members,
        current_members=1,
        settings={
            "allow_reactions": True,
            "allow_typing_indicator": True,
            "message_history_limit": 50,
        },
    )

    db.session.add(room)
    db.session.commit()

    return success_response("Topluluk oluşturuldu.", {
        "community_id": community.id,
        "community_name": community.name,
        "chat_room_id": room.id,
    }, status_code=201)