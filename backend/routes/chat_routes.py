"""
Chat routes for community messages.
"""

from __future__ import annotations

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database.db_connection import db
from backend.models.chat_model import ChatMessage
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_room_model import ChatRoom
from backend.utils.helpers import success_response, error_response

chat_bp = Blueprint("chat", __name__)

def ensure_chat_room(community: Community) -> ChatRoom:
    """
    Ensure a chat room exists for a community.
    """

    room = ChatRoom.query.filter_by(community_id=community.id).first()

    if room:
        return room

    room = ChatRoom(
        community_id=community.id,
        name=f"{community.name} Sohbet Odası",
        description=f"{community.name} topluluğu için ana sohbet odası.",
        is_active=True,
        max_members=community.max_members,
        current_members=CommunityMember.query.filter_by(
            community_id=community.id,
            is_active=True,
        ).count(),
        settings={
            "allow_reactions": True,
            "allow_typing_indicator": True,
            "message_history_limit": 50,
        },
    )

    db.session.add(room)
    db.session.commit()

    return room


def user_can_access_community(user_id: int, community_id: int) -> bool:
    """
    Check whether user is an active member of the community.
    """

    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()

    return membership is not None


@chat_bp.route("/<int:community_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(community_id: int) -> tuple:
    """
    Return last 50 messages for a community.
    """

    user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_can_access_community(user_id, community_id):
        return error_response("Bu topluluğun mesajlarını görmek için önce katılmalısınız.", status_code=403)

    ensure_chat_room(community)

    messages = (
        ChatMessage.query
        .filter_by(community_id=community_id)
        .order_by(ChatMessage.timestamp.desc())
        .limit(50)
        .all()
    )

    data = []

    for message in reversed(messages):
        data.append({
            "id": message.id,
            "community_id": message.community_id,
            "user_id": message.user_id,
            "content": message.content,
            "message_type": message.message_type,
            "timestamp": message.timestamp.isoformat() if message.timestamp else None,
            "edited": message.edited,
            "edited_at": message.edited_at.isoformat() if message.edited_at else None,
            "reply_to": message.reply_to,
            "reactions": message.reactions or {},
        })

    return success_response("Mesajlar getirildi.", data)

@chat_bp.route("/message", methods=["POST"])
@jwt_required()
def create_message() -> tuple:
    """
    Persist a message and broadcast it to the community room.
    """

    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    community_id = data.get("community_id")
    content = str(data.get("content", "")).strip()
    message_type = data.get("message_type", "text")

    if not community_id:
        return error_response("Topluluk ID zorunludur.")

    if not content:
        return error_response("Mesaj içeriği boş olamaz.")

    if len(content) > 2000:
        return error_response("Mesaj 2000 karakterden uzun olamaz.")

    if message_type not in ["text", "image", "system"]:
        return error_response("Geçersiz mesaj tipi.")

    community = Community.query.get(int(community_id))

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_can_access_community(user_id, community.id):
        return error_response("Mesaj göndermek için önce topluluğa katılmalısınız.", status_code=403)

    room = ensure_chat_room(community)

    message = ChatMessage(
        community_id=community.id,
        user_id=user_id,
        content=content,
        message_type=message_type,
        reactions={},
    )

    db.session.add(message)

    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community.id,
    ).first()

    if membership:
        membership.message_count = (membership.message_count or 0) + 1

    room.current_members = CommunityMember.query.filter_by(
        community_id=community.id,
        is_active=True,
    ).count()

    db.session.commit()

    payload = {
        "id": message.id,
        "community_id": message.community_id,
        "chat_room_id": room.id,
        "user_id": message.user_id,
        "content": message.content,
        "message_type": message.message_type,
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "edited": message.edited,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
        "reply_to": message.reply_to,
        "reactions": message.reactions or {},
    }

    socketio = current_app.extensions.get("socketio")

    if socketio:
        socketio.emit(
            "receive_message",
            payload,
            room=str(community.id),
        )

    return success_response("Mesaj gönderildi.", payload, status_code=201)