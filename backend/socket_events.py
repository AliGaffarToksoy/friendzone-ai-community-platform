"""
Socket.IO events for real-time community chat.
"""

from __future__ import annotations

from datetime import datetime

from flask import request
from flask_socketio import emit, join_room, leave_room

from backend.database.db_connection import db
from backend.models.chat_model import ChatMessage, ChatUserStatus
from backend.models.community_model import CommunityMember


def register_socketio_events(socketio):
    """
    Register all Socket.IO event handlers.
    """

    @socketio.on("connect")
    def handle_connect():
        emit("connected", {
            "success": True,
            "message": "Socket bağlantısı kuruldu.",
            "socket_id": request.sid,
        })

    @socketio.on("disconnect")
    def handle_disconnect():
        try:
            status = ChatUserStatus.query.filter_by(socket_id=request.sid).first()

            if status:
                room_id = status.room_id
                user_id = status.user_id

                status.is_online = False
                status.last_seen = datetime.utcnow()
                status.socket_id = None

                db.session.commit()

                emit(
                    "user_offline",
                    {
                        "user_id": user_id,
                        "room_id": room_id,
                    },
                    broadcast=True,
                )
        except Exception:
            db.session.rollback()

    @socketio.on("join_room")
    def handle_join_room(data):
        """
        Join a community chat room.

        Frontend sends room_id as community_id.
        Socket room name is also community_id for simplicity.
        """

        room_id = str(data.get("room_id") or "")
        user_id = data.get("user_id")

        if not room_id or not user_id:
            emit("socket_error", {
                "message": "Oda veya kullanıcı bilgisi eksik."
            })
            return

        try:
            community_id = int(room_id)
            parsed_user_id = int(user_id)
        except Exception:
            emit("socket_error", {
                "message": "Geçersiz oda veya kullanıcı bilgisi."
            })
            return

        membership = CommunityMember.query.filter_by(
            user_id=parsed_user_id,
            community_id=community_id,
            is_active=True,
        ).first()

        if not membership:
            emit("socket_error", {
                "message": "Bu odaya katılmak için topluluk üyesi olmalısınız."
            })
            return

        join_room(room_id)

        try:
            status = ChatUserStatus.query.filter_by(
                user_id=parsed_user_id,
                room_id=community_id,
            ).first()

            if not status:
                status = ChatUserStatus(
                    user_id=parsed_user_id,
                    room_id=community_id,
                    is_online=True,
                    socket_id=request.sid,
                    last_seen=datetime.utcnow(),
                )
                db.session.add(status)
            else:
                status.is_online = True
                status.socket_id = request.sid
                status.last_seen = datetime.utcnow()

            db.session.commit()
        except Exception:
            db.session.rollback()

        emit(
            "user_online",
            {
                "user_id": parsed_user_id,
                "room_id": community_id,
            },
            room=room_id,
        )

        emit("joined_room", {
            "success": True,
            "room_id": community_id,
            "user_id": parsed_user_id,
        })

    @socketio.on("leave_room")
    def handle_leave_room_event(data):
        room_id = str(data.get("room_id") or "")
        user_id = data.get("user_id")

        if not room_id or not user_id:
            return

        leave_room(room_id)

        try:
            status = ChatUserStatus.query.filter_by(
                user_id=int(user_id),
                room_id=int(room_id),
            ).first()

            if status:
                status.is_online = False
                status.last_seen = datetime.utcnow()
                status.socket_id = None
                db.session.commit()
        except Exception:
            db.session.rollback()

        emit(
            "user_offline",
            {
                "user_id": user_id,
                "room_id": room_id,
            },
            room=room_id,
        )

    @socketio.on("typing")
    def handle_typing(data):
        room_id = str(data.get("room_id") or "")
        user_id = data.get("user_id")

        if not room_id or not user_id:
            return

        emit(
            "typing",
            {
                "room_id": room_id,
                "user_id": user_id,
            },
            room=room_id,
            include_self=False,
        )

    @socketio.on("stop_typing")
    def handle_stop_typing(data):
        room_id = str(data.get("room_id") or "")
        user_id = data.get("user_id")

        if not room_id or not user_id:
            return

        emit(
            "stop_typing",
            {
                "room_id": room_id,
                "user_id": user_id,
            },
            room=room_id,
            include_self=False,
        )

    @socketio.on("add_reaction")
    def handle_add_reaction(data):
        message_id = data.get("message_id")
        reaction = data.get("reaction")
        user_id = data.get("user_id")
        room_id = str(data.get("room_id") or "")

        if not message_id or not reaction or not user_id:
            emit("reaction_error", {
                "message": "Reaction için gerekli bilgiler eksik."
            })
            return

        try:
            message = ChatMessage.query.get(int(message_id))

            if not message:
                emit("reaction_error", {
                    "message": "Mesaj bulunamadı."
                })
                return

            parsed_user_id = int(user_id)
            community_id = int(message.community_id)

            membership = CommunityMember.query.filter_by(
                user_id=parsed_user_id,
                community_id=community_id,
                is_active=True,
            ).first()

            if not membership:
                emit("reaction_error", {
                    "message": "Reaction eklemek için topluluk üyesi olmalısınız."
                })
                return

            reactions = message.reactions or {}
            normalized_user_id = str(parsed_user_id)

            existing_users = reactions.get(reaction, [])
            existing_users = [str(item) for item in existing_users]

            if normalized_user_id in existing_users:
                existing_users = [
                    item for item in existing_users
                    if item != normalized_user_id
                ]
            else:
                existing_users.append(normalized_user_id)

            if existing_users:
                reactions[reaction] = existing_users
            else:
                reactions.pop(reaction, None)

            message.reactions = reactions
            db.session.commit()

            emit(
                "reaction_updated",
                {
                    "message_id": message.id,
                    "community_id": community_id,
                    "room_id": room_id or str(community_id),
                    "reaction": reaction,
                    "reactions": reactions,
                },
                room=room_id or str(community_id),
            )

        except Exception as exc:
            db.session.rollback()
            emit("reaction_error", {
                "message": "Reaction kaydedilemedi.",
                "error": str(exc),
            })