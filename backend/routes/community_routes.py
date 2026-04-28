"""
Community routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database.db_connection import db
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_room_model import ChatRoom
from backend.models.user_model import User
from backend.services.recommendation_service import get_recommended_communities
from backend.utils.helpers import success_response, error_response


community_bp = Blueprint("community", __name__)


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


@community_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def list_communities() -> tuple:
    """
    Return all active communities.
    """

    communities = Community.query.filter_by(is_active=True).order_by(Community.created_at.desc()).all()

    data = []

    for community in communities:
        ensure_chat_room_for_community(community)

        data.append({
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "category": community.category,
            "tags": community.tags or [],
            "compatibility_score": community.compatibility_score,
            "member_count": CommunityMember.query.filter_by(
                community_id=community.id,
                is_active=True,
            ).count(),
            "max_members": community.max_members,
            "is_active": community.is_active,
        })

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

    communities = get_recommended_communities(user)

    data = []

    for item in communities:
        community = item.get("community") if isinstance(item, dict) else item
        score = item.get("score", 0) if isinstance(item, dict) else 0

        ensure_chat_room_for_community(community)

        data.append({
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "category": community.category,
            "tags": community.tags or [],
            "compatibility_score": score,
            "member_count": CommunityMember.query.filter_by(
                community_id=community.id,
                is_active=True,
            ).count(),
            "max_members": community.max_members,
            "is_active": community.is_active,
        })

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

        data.append({
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "category": community.category,
            "role": membership.role,
            "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
            "member_count": CommunityMember.query.filter_by(
                community_id=community.id,
                is_active=True,
            ).count(),
        })

    return success_response("Kullanıcının toplulukları getirildi.", data)


@community_bp.route("/<int:community_id>", methods=["GET"])
@jwt_required()
def get_community(community_id: int) -> tuple:
    """
    Return community details.
    """

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    room = ensure_chat_room_for_community(community)

    data = {
        "id": community.id,
        "name": community.name,
        "description": community.description,
        "category": community.category,
        "tags": community.tags or [],
        "compatibility_score": community.compatibility_score,
        "member_count": CommunityMember.query.filter_by(
            community_id=community.id,
            is_active=True,
        ).count(),
        "max_members": community.max_members,
        "is_active": community.is_active,
        "chat_room": {
            "id": room.id,
            "name": room.name,
            "description": room.description,
            "current_members": room.current_members,
            "max_members": room.max_members,
        },
    }

    return success_response("Topluluk detayı getirildi.", data)


@community_bp.route("/join", methods=["POST"])
@jwt_required()
def join_community() -> tuple:
    """
    Join the current user to a community.
    """

    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    community_id = data.get("community_id")

    if not community_id:
        return error_response("Topluluk ID zorunludur.")

    community = Community.query.get(int(community_id))

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    active_member_count = CommunityMember.query.filter_by(
        community_id=community.id,
        is_active=True,
    ).count()

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
    room.current_members = CommunityMember.query.filter_by(
        community_id=community.id,
        is_active=True,
    ).count()

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
    data = request.get_json() or {}

    name = str(data.get("name", "")).strip()
    description = str(data.get("description", "")).strip()
    category = str(data.get("category", "")).strip()
    tags = data.get("tags", [])
    max_members = data.get("max_members", 100)

    if not name or len(name) < 3:
        return error_response("Topluluk adı en az 3 karakter olmalıdır.")

    if not description or len(description) < 20:
        return error_response("Açıklama en az 20 karakter olmalıdır.")

    if not category:
        return error_response("Kategori zorunludur.")

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