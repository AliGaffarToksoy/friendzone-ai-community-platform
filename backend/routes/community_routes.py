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
from backend.services.gamification_service import add_points
from backend.services.recommendation_service import get_recommended_communities
from backend.utils.helpers import error_response, success_response


community_bp = Blueprint("community", __name__)


VALID_SCOPES = {"university", "city", "country", "online"}
VALID_MEMBER_ROLES = {"admin", "moderator", "member"}


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


def get_membership(user_id: int, community_id: int) -> CommunityMember | None:
    """
    Return active membership for a user in a community.
    """

    return CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()


def get_admin_count(community_id: int) -> int:
    """
    Return active admin count for a community.
    """

    return CommunityMember.query.filter_by(
        community_id=community_id,
        role="admin",
        is_active=True,
    ).count()


def is_admin(user_id: int, community_id: int) -> bool:
    """
    Check whether user is community admin.
    """

    membership = get_membership(user_id, community_id)
    return bool(membership and membership.role == "admin")


def is_moderator_or_admin(user_id: int, community_id: int) -> bool:
    """
    Check whether user can manage community-level operational features.
    """

    membership = get_membership(user_id, community_id)
    return bool(membership and membership.role in {"admin", "moderator"})


def serialize_member(membership: CommunityMember, viewer_role: str = "member") -> dict:
    """
    Serialize community member.

    Admins and moderators can see more operational information.
    Regular members see basic profile information.
    """

    user = membership.user

    data = {
        "membership_id": membership.id,
        "user_id": membership.user_id,
        "name": user.name if user else "Bilinmeyen Kullanıcı",
        "role": membership.role,
        "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
        "is_active": membership.is_active,
        "message_count": membership.message_count or 0,
        "profile_image": user.profile_image if user else None,
        "university": user.university if user else None,
        "department": user.department if user else None,
        "year": user.year if user else None,
        "city": user.city if user else None,
        "personality_type": user.personality_type if user else None,
    }

    if viewer_role in {"admin", "moderator"}:
        data["email"] = user.email if user else None
        data["last_active"] = membership.last_active.isoformat() if membership.last_active else None

    return data


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

    membership = get_membership(user.id, community.id)

    if not is_community_visible_for_user(community, user):
        if not membership:
            return error_response("Bu topluluğu görüntüleme yetkiniz yok.", status_code=403)

    room = ensure_chat_room_for_community(community)

    data = serialize_community(community)
    data["current_user_role"] = membership.role if membership else None
    data["is_current_user_admin"] = bool(membership and membership.role == "admin")
    data["is_current_user_moderator"] = bool(membership and membership.role == "moderator")
    data["can_manage_members"] = bool(membership and membership.role == "admin")
    data["can_manage_events"] = bool(membership and membership.role in {"admin", "moderator"})

    data["chat_room"] = {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "current_members": room.current_members,
        "max_members": room.max_members,
    }

    return success_response("Topluluk detayı getirildi.", data)


@community_bp.route("/<int:community_id>/members", methods=["GET"])
@jwt_required()
def list_community_members(community_id: int) -> tuple:
    """
    List active members of a community.

    Regular members can see member names and roles.
    Admins/moderators can see more operational information.
    """

    current_user_id = int(get_jwt_identity())
    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    viewer_membership = get_membership(current_user_id, community_id)

    if not viewer_membership:
        return error_response("Üyeleri görüntülemek için topluluğa üye olmalısınız.", status_code=403)

    memberships = (
        CommunityMember.query
        .filter_by(community_id=community_id, is_active=True)
        .order_by(
            CommunityMember.role.asc(),
            CommunityMember.joined_at.asc(),
        )
        .all()
    )

    data = {
        "community_id": community.id,
        "viewer_role": viewer_membership.role,
        "can_manage_members": viewer_membership.role == "admin",
        "can_moderate": viewer_membership.role in {"admin", "moderator"},
        "members": [
            serialize_member(membership, viewer_role=viewer_membership.role)
            for membership in memberships
        ],
    }

    return success_response("Topluluk üyeleri getirildi.", data)


@community_bp.route("/<int:community_id>/members/<int:target_user_id>/role", methods=["PATCH"])
@jwt_required()
def update_member_role(community_id: int, target_user_id: int) -> tuple:
    """
    Update a member's role.

    Only community admins can change roles.
    Admins cannot remove the last admin.
    """

    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    new_role = str(data.get("role", "")).strip()

    if new_role not in VALID_MEMBER_ROLES:
        return error_response("Geçersiz rol. Rol admin, moderator veya member olmalıdır.")

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    actor_membership = get_membership(current_user_id, community_id)

    if not actor_membership or actor_membership.role != "admin":
        return error_response("Rol değiştirmek için topluluk admini olmalısınız.", status_code=403)

    target_membership = get_membership(target_user_id, community_id)

    if not target_membership:
        return error_response("Hedef kullanıcı bu toplulukta aktif üye değil.", status_code=404)

    old_role = target_membership.role

    if target_membership.role == "admin" and new_role != "admin":
        if get_admin_count(community_id) <= 1:
            return error_response("Toplulukta en az bir admin kalmalıdır.", status_code=409)

    target_membership.role = new_role
    db.session.commit()

    if old_role != new_role:
        add_points(
            user_id=current_user_id,
            action_type="member_role_updated",
            description=f"{community.name} topluluğunda üye rolü güncelledi.",
            reference_type="community_member_role",
            reference_id=target_membership.id,
            allow_duplicate=True,
        )

    return success_response("Üye rolü güncellendi.", {
        "community_id": community_id,
        "user_id": target_user_id,
        "role": new_role,
    })


@community_bp.route("/<int:community_id>/members/<int:target_user_id>", methods=["DELETE"])
@jwt_required()
def remove_community_member(community_id: int, target_user_id: int) -> tuple:
    """
    Remove a member from a community.

    Admins can remove anyone except the last admin.
    Moderators can remove regular members only.
    """

    current_user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    actor_membership = get_membership(current_user_id, community_id)

    if not actor_membership or actor_membership.role not in {"admin", "moderator"}:
        return error_response("Üye çıkarmak için admin veya moderatör olmalısınız.", status_code=403)

    target_membership = get_membership(target_user_id, community_id)

    if not target_membership:
        return error_response("Hedef kullanıcı bu toplulukta aktif üye değil.", status_code=404)

    if target_membership.role == "admin":
        if actor_membership.role != "admin":
            return error_response("Moderatörler admin kullanıcıları çıkaramaz.", status_code=403)

        if get_admin_count(community_id) <= 1:
            return error_response("Topluluktaki son admin çıkarılamaz.", status_code=409)

    if actor_membership.role == "moderator" and target_membership.role in {"admin", "moderator"}:
        return error_response("Moderatörler yalnızca normal üyeleri çıkarabilir.", status_code=403)

    target_membership.is_active = False
    db.session.commit()

    return success_response("Üye topluluktan çıkarıldı.", {
        "community_id": community_id,
        "user_id": target_user_id,
    })


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

    joined_now = False

    if existing:
        if existing.is_active:
            return success_response("Zaten bu topluluğa üyesiniz.", {
                "community_id": community.id,
                "community_name": community.name,
            })

        existing.is_active = True
        existing.role = existing.role or "member"
        joined_now = True
    else:
        membership = CommunityMember(
            community_id=community.id,
            user_id=user_id,
            role="member",
            is_active=True,
        )
        db.session.add(membership)
        db.session.flush()
        joined_now = True

    room = ensure_chat_room_for_community(community)
    room.current_members = get_member_count(community.id)

    db.session.commit()

    if joined_now:
        add_points(
            user_id=user_id,
            action_type="community_joined",
            description=f"{community.name} topluluğuna katıldı.",
            reference_type="community",
            reference_id=community.id,
            allow_duplicate=False,
        )

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

    add_points(
        user_id=user_id,
        action_type="community_created",
        description=f"{community.name} topluluğunu oluşturdu.",
        reference_type="community",
        reference_id=community.id,
        allow_duplicate=False,
    )

    return success_response("Topluluk oluşturuldu.", {
        "community_id": community.id,
        "community_name": community.name,
        "chat_room_id": room.id,
    }, status_code=201)