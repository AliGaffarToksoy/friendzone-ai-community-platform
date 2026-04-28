"""
Recommendation service for FriendZone communities.

This service returns recommended communities for a user by using the advanced
matching logic in backend/ml/community_assigner.py.

It is intentionally kept as a service layer so routes do not directly depend
on scoring implementation details.
"""

from __future__ import annotations

from backend.models.community_model import Community, CommunityMember
from backend.models.user_model import User
from backend.ml.community_assigner import calculate_community_match


def get_recommended_communities(user: User, limit: int = 6) -> list[dict]:
    """
    Return recommended active communities for a user.

    Args:
        user: SQLAlchemy User object.
        limit: Maximum number of recommendations.

    Returns:
        [
            {
                "community": Community,
                "score": 87,
                "breakdown": {
                    "hobby_score": 90,
                    "category_score": 80,
                    "personality_score": 75,
                    "total_score": 84
                },
                "is_member": True
            }
        ]
    """

    communities = Community.query.filter_by(is_active=True).all()

    recommendations = []

    for community in communities:
        breakdown = calculate_community_match(user, community)

        is_member = CommunityMember.query.filter_by(
            user_id=user.id,
            community_id=community.id,
            is_active=True,
        ).first() is not None

        recommendations.append({
            "community": community,
            "score": breakdown.total_score,
            "breakdown": {
                "hobby_score": breakdown.hobby_score,
                "category_score": breakdown.category_score,
                "personality_score": breakdown.personality_score,
                "total_score": breakdown.total_score,
            },
            "is_member": is_member,
        })

    recommendations.sort(
        key=lambda item: (
            item["score"],
            item["community"].member_count if hasattr(item["community"], "member_count") else 0,
            item["community"].id,
        ),
        reverse=True,
    )

    return recommendations[:limit]


def get_recommendations_for_user(user: User, limit: int = 6) -> list[dict]:
    """
    Backward-compatible alias.

    Some older code may call get_recommendations_for_user.
    """

    return get_recommended_communities(user, limit)


def serialize_recommendations(recommendations: list[dict]) -> list[dict]:
    """
    Convert recommendation objects into JSON-serializable dictionaries.
    """

    data = []

    for item in recommendations:
        community = item["community"]
        breakdown = item.get("breakdown", {})

        member_count = CommunityMember.query.filter_by(
            community_id=community.id,
            is_active=True,
        ).count()

        data.append({
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "category": community.category,
            "tags": community.tags or [],
            "compatibility_score": item.get("score", 0),
            "match_breakdown": breakdown,
            "is_member": item.get("is_member", False),
            "member_count": member_count,
            "max_members": community.max_members,
            "is_active": community.is_active,
        })

    return data