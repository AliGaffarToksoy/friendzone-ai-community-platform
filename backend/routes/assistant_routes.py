"""
Assistant routes for GPT-powered community suggestions.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.models.chat_model import ChatMessage
from backend.models.community_model import Community, CommunityMember
from backend.services.gpt_service import generate_community_suggestions
from backend.utils.helpers import success_response, error_response


assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.route("/community-suggestion", methods=["POST"])
@jwt_required()
def community_suggestion() -> tuple:
    """
    Generate GPT-powered community suggestions.

    Expected payload:
    {
      "community_id": 1
    }

    Backward-compatible payload:
    {
      "community_name": "Yapay Zeka",
      "category": "Teknoloji"
    }
    """

    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    community_id = data.get("community_id")
    community_name = data.get("community_name")
    category = data.get("category")
    member_count = None
    recent_messages = []

    if community_id:
        community = Community.query.get(int(community_id))

        if not community or not community.is_active:
            return error_response("Topluluk bulunamadı.", status_code=404)

        membership = CommunityMember.query.filter_by(
            user_id=user_id,
            community_id=community.id,
            is_active=True,
        ).first()

        if not membership:
            return error_response(
                "AI asistanı kullanmak için bu topluluğa üye olmalısınız.",
                status_code=403,
            )

        community_name = community.name
        category = community.category

        member_count = CommunityMember.query.filter_by(
            community_id=community.id,
            is_active=True,
        ).count()

        messages = (
            ChatMessage.query
            .filter_by(community_id=community.id)
            .order_by(ChatMessage.timestamp.desc())
            .limit(8)
            .all()
        )

        recent_messages = [
            message.content
            for message in reversed(messages)
            if message.content
        ]

    result = generate_community_suggestions(
        community_name=community_name,
        category=category,
        member_count=member_count,
        recent_messages=recent_messages,
    )

    return success_response("AI önerileri oluşturuldu.", result)