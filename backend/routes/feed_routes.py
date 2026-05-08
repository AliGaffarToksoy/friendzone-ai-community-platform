"""
Feed routes for FriendZone.
"""

from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from backend.database.db_connection import db
from backend.models.community_model import Community, CommunityMember
from backend.models.event_model import Event
from backend.models.feed_model import FeedComment, FeedLike, FeedPost
from backend.models.user_model import User
from backend.services.gamification_service import add_points
from backend.utils.helpers import error_response, success_response


feed_bp = Blueprint("feed", __name__)


VALID_POST_TYPES = {
    "text",
    "event",
    "achievement",
    "community_update",
    "question",
    "idea",
}

VALID_VISIBILITY = {
    "public",
    "community",
    "followers",
}


def get_current_user_id() -> int:
    """
    Return JWT user id as integer.
    """

    return int(get_jwt_identity())


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


def user_can_post_to_community(user_id: int, community_id: int) -> bool:
    """
    Active community members can post to community feed.
    """

    return user_is_community_member(user_id, community_id)


def user_can_delete_post(user_id: int, post: FeedPost) -> bool:
    """
    Post owner can delete post.
    Community admin/moderator can delete community posts.
    """

    if post.user_id == user_id:
        return True

    if not post.community_id:
        return False

    membership = CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=post.community_id,
        is_active=True,
    ).first()

    if not membership:
        return False

    return membership.role in {"admin", "moderator"}


def user_can_view_post(user_id: int, post: FeedPost) -> bool:
    """
    Public posts are visible to authenticated users.
    Community posts are visible to community members.
    """

    if not post.is_active:
        return False

    if post.visibility == "public":
        return True

    if post.visibility == "community" and post.community_id:
        return user_is_community_member(user_id, post.community_id)

    if post.user_id == user_id:
        return True

    return False


def serialize_post(post: FeedPost, viewer_id: int) -> dict:
    """
    Serialize feed post with related data.
    """

    user = User.query.get(post.user_id)

    community = None
    if post.community_id:
        community = Community.query.get(post.community_id)

    event = None
    if post.event_id:
        event = Event.query.get(post.event_id)

    like_count = FeedLike.query.filter_by(post_id=post.id).count()

    comment_count = FeedComment.query.filter_by(
        post_id=post.id,
        is_active=True,
    ).count()

    is_liked_by_me = FeedLike.query.filter_by(
        post_id=post.id,
        user_id=viewer_id,
    ).first() is not None

    data = post.to_dict(
        user=user,
        community=community,
        event=event,
        like_count=like_count,
        comment_count=comment_count,
        is_liked_by_me=is_liked_by_me,
    )

    data["can_delete"] = user_can_delete_post(viewer_id, post)

    return data


def serialize_comment(comment: FeedComment) -> dict:
    """
    Serialize comment with user.
    """

    user = User.query.get(comment.user_id)

    return comment.to_dict(user=user)


@feed_bp.route("", methods=["GET"])
@jwt_required()
def list_feed() -> tuple:
    """
    List feed posts.

    Query params:
    - scope: all | my_communities | community | me
    - community_id
    - post_type
    - limit
    """

    user_id = get_current_user_id()

    scope = request.args.get("scope", "all")
    community_id = request.args.get("community_id")
    post_type = request.args.get("post_type")

    try:
        limit = int(request.args.get("limit", 30))
    except Exception:
        limit = 30

    limit = max(1, min(100, limit))

    query = FeedPost.query.filter_by(is_active=True)

    if post_type:
        query = query.filter(FeedPost.post_type == post_type)

    if scope == "me":
        query = query.filter(FeedPost.user_id == user_id)

    elif scope == "community":
        if not community_id:
            return error_response("Topluluk ID zorunludur.")

        community = Community.query.get(int(community_id))

        if not community or not community.is_active:
            return error_response("Topluluk bulunamadı.", status_code=404)

        if not user_is_community_member(user_id, community.id):
            return error_response("Bu topluluğun akışını görmek için üye olmalısınız.", status_code=403)

        query = query.filter(
            FeedPost.community_id == community.id,
            FeedPost.visibility == "community",
        )

    elif scope == "my_communities":
        memberships = CommunityMember.query.filter_by(
            user_id=user_id,
            is_active=True,
        ).all()

        community_ids = [membership.community_id for membership in memberships]

        query = query.filter(
            or_(
                FeedPost.visibility == "public",
                FeedPost.community_id.in_(community_ids) if community_ids else False,
            )
        )

    else:
        memberships = CommunityMember.query.filter_by(
            user_id=user_id,
            is_active=True,
        ).all()

        community_ids = [membership.community_id for membership in memberships]

        query = query.filter(
            or_(
                FeedPost.visibility == "public",
                FeedPost.user_id == user_id,
                FeedPost.community_id.in_(community_ids) if community_ids else False,
            )
        )

    posts = (
        query
        .order_by(FeedPost.is_pinned.desc(), FeedPost.created_at.desc())
        .limit(limit)
        .all()
    )

    data = [
        serialize_post(post, viewer_id=user_id)
        for post in posts
        if user_can_view_post(user_id, post)
    ]

    return success_response("Akış gönderileri getirildi.", data)


@feed_bp.route("/posts", methods=["POST"])
@jwt_required()
def create_post() -> tuple:
    """
    Create feed post.
    """

    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    content = str(data.get("content", "")).strip()
    post_type = str(data.get("post_type", "text")).strip()
    visibility = str(data.get("visibility", "public")).strip()
    community_id = data.get("community_id")
    event_id = data.get("event_id")
    link_url = str(data.get("link_url", "")).strip()

    if not content or len(content) < 2:
        return error_response("Paylaşım içeriği en az 2 karakter olmalıdır.")

    if len(content) > 3000:
        return error_response("Paylaşım içeriği en fazla 3000 karakter olabilir.")

    if post_type not in VALID_POST_TYPES:
        return error_response("Geçersiz paylaşım tipi.")

    if visibility not in VALID_VISIBILITY:
        return error_response("Geçersiz görünürlük tipi.")

    community = None

    if community_id:
        community = Community.query.get(int(community_id))

        if not community or not community.is_active:
            return error_response("Topluluk bulunamadı.", status_code=404)

        if not user_can_post_to_community(user_id, community.id):
            return error_response("Bu topluluğa paylaşım yapmak için üye olmalısınız.", status_code=403)

        visibility = "community"

    event = None

    if event_id:
        event = Event.query.get(int(event_id))

        if not event or not event.is_active:
            return error_response("Etkinlik bulunamadı.", status_code=404)

        if not user_is_community_member(user_id, event.community_id):
            return error_response("Bu etkinliği paylaşmak için ilgili topluluğa üye olmalısınız.", status_code=403)

        if not community_id:
            community_id = event.community_id
            visibility = "community"

    post = FeedPost(
        user_id=user_id,
        community_id=int(community_id) if community_id else None,
        event_id=int(event_id) if event_id else None,
        content=content,
        post_type=post_type,
        visibility=visibility,
        image_url=None,
        link_url=link_url or None,
        is_pinned=False,
        is_active=True,
    )

    db.session.add(post)
    db.session.commit()

    add_points(
        user_id=user_id,
        action_type="feed_post_created",
        description="Ana akışta paylaşım oluşturdu.",
        reference_type="feed_post",
        reference_id=post.id,
        allow_duplicate=False,
    )

    return success_response("Paylaşım oluşturuldu.", serialize_post(post, viewer_id=user_id), status_code=201)


@feed_bp.route("/posts/<int:post_id>", methods=["GET"])
@jwt_required()
def get_post(post_id: int) -> tuple:
    """
    Get feed post detail.
    """

    user_id = get_current_user_id()

    post = FeedPost.query.get(post_id)

    if not post or not user_can_view_post(user_id, post):
        return error_response("Paylaşım bulunamadı.", status_code=404)

    return success_response("Paylaşım detayı getirildi.", serialize_post(post, viewer_id=user_id))


@feed_bp.route("/posts/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_post(post_id: int) -> tuple:
    """
    Soft-delete feed post.
    """

    user_id = get_current_user_id()

    post = FeedPost.query.get(post_id)

    if not post or not post.is_active:
        return error_response("Paylaşım bulunamadı.", status_code=404)

    if not user_can_delete_post(user_id, post):
        return error_response("Bu paylaşımı silme yetkiniz yok.", status_code=403)

    post.is_active = False
    db.session.commit()

    return success_response("Paylaşım silindi.", {
        "post_id": post.id,
        "is_active": post.is_active,
    })


@feed_bp.route("/posts/<int:post_id>/like", methods=["POST"])
@jwt_required()
def toggle_like(post_id: int) -> tuple:
    """
    Toggle like on feed post.

    Liker gets small interaction points.
    Post owner gets visibility points when another user likes their post.
    """

    user_id = get_current_user_id()

    post = FeedPost.query.get(post_id)

    if not post or not user_can_view_post(user_id, post):
        return error_response("Paylaşım bulunamadı.", status_code=404)

    existing = FeedLike.query.filter_by(
        post_id=post.id,
        user_id=user_id,
    ).first()

    liked = False

    if existing:
        db.session.delete(existing)
        liked = False
    else:
        like = FeedLike(
            post_id=post.id,
            user_id=user_id,
        )
        db.session.add(like)
        liked = True

    db.session.commit()

    if liked:
        add_points(
            user_id=user_id,
            action_type="feed_post_liked",
            description="Bir paylaşımı beğendi.",
            reference_type="feed_like",
            reference_id=post.id,
            allow_duplicate=False,
        )

        if post.user_id != user_id:
            add_points(
                user_id=post.user_id,
                action_type="feed_post_received_like",
                points=2,
                description="Paylaşımı beğeni aldı.",
                reference_type="feed_post_like_received",
                reference_id=post.id,
                allow_duplicate=True,
            )

    like_count = FeedLike.query.filter_by(post_id=post.id).count()

    return success_response("Beğeni durumu güncellendi.", {
        "post_id": post.id,
        "liked": liked,
        "like_count": like_count,
    })


@feed_bp.route("/posts/<int:post_id>/comments", methods=["GET"])
@jwt_required()
def list_comments(post_id: int) -> tuple:
    """
    List comments for a feed post.
    """

    user_id = get_current_user_id()

    post = FeedPost.query.get(post_id)

    if not post or not user_can_view_post(user_id, post):
        return error_response("Paylaşım bulunamadı.", status_code=404)

    comments = (
        FeedComment.query
        .filter_by(post_id=post.id, is_active=True)
        .order_by(FeedComment.created_at.asc())
        .all()
    )

    data = [serialize_comment(comment) for comment in comments]

    return success_response("Yorumlar getirildi.", data)


@feed_bp.route("/posts/<int:post_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(post_id: int) -> tuple:
    """
    Create comment for a feed post.
    """

    user_id = get_current_user_id()

    post = FeedPost.query.get(post_id)

    if not post or not user_can_view_post(user_id, post):
        return error_response("Paylaşım bulunamadı.", status_code=404)

    data = request.get_json(silent=True) or {}

    content = str(data.get("content", "")).strip()

    if not content or len(content) < 1:
        return error_response("Yorum boş olamaz.")

    if len(content) > 800:
        return error_response("Yorum en fazla 800 karakter olabilir.")

    comment = FeedComment(
        post_id=post.id,
        user_id=user_id,
        content=content,
        is_active=True,
    )

    db.session.add(comment)
    db.session.commit()

    add_points(
        user_id=user_id,
        action_type="feed_comment_created",
        description="Ana akışta yorum yaptı.",
        reference_type="feed_comment",
        reference_id=comment.id,
        allow_duplicate=False,
    )

    if post.user_id != user_id:
        add_points(
            user_id=post.user_id,
            action_type="feed_post_received_comment",
            points=3,
            description="Paylaşımı yorum aldı.",
            reference_type="feed_post_comment_received",
            reference_id=comment.id,
            allow_duplicate=False,
        )

    return success_response("Yorum eklendi.", serialize_comment(comment), status_code=201)


@feed_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id: int) -> tuple:
    """
    Soft-delete comment.
    """

    user_id = get_current_user_id()

    comment = FeedComment.query.get(comment_id)

    if not comment or not comment.is_active:
        return error_response("Yorum bulunamadı.", status_code=404)

    post = FeedPost.query.get(comment.post_id)

    if not post:
        return error_response("Paylaşım bulunamadı.", status_code=404)

    can_delete = (
        comment.user_id == user_id
        or post.user_id == user_id
        or user_can_delete_post(user_id, post)
    )

    if not can_delete:
        return error_response("Bu yorumu silme yetkiniz yok.", status_code=403)

    comment.is_active = False
    db.session.commit()

    return success_response("Yorum silindi.", {
        "comment_id": comment.id,
        "is_active": comment.is_active,
    })