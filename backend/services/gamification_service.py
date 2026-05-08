"""
Gamification service for FriendZone.

This service handles:
- Social point creation/update
- Point transaction history
- Level calculation
- Default badge seeding
- Automatic badge assignment
- Default certificate seeding
- Automatic certificate assignment
- Gamification profile summary
"""

from __future__ import annotations

import uuid

from backend.database.db_connection import db
from backend.models.certificate_model import Certificate, UserCertificate
from backend.models.gamification_model import (
    Badge,
    UserBadge,
    UserPoint,
    UserPointTransaction,
)


DEFAULT_BADGES = [
    {
        "code": "first_step",
        "name": "İlk Adım",
        "description": "FriendZone üzerinde sosyal profilini oluşturmaya başladın.",
        "icon": "🏁",
        "category": "profile",
        "required_points": 10,
    },
    {
        "code": "social_starter",
        "name": "Sosyal Başlangıç",
        "description": "İlk sosyal etkileşimlerini gerçekleştirdin.",
        "icon": "💬",
        "category": "social",
        "required_points": 25,
    },
    {
        "code": "community_member",
        "name": "Topluluk Üyesi",
        "description": "Topluluklara katılarak sosyal ağını genişlettin.",
        "icon": "🌐",
        "category": "community",
        "required_points": 40,
    },
    {
        "code": "event_explorer",
        "name": "Etkinlik Kaşifi",
        "description": "Etkinliklere katılarak kampüs deneyimini güçlendirdin.",
        "icon": "📅",
        "category": "event",
        "required_points": 60,
    },
    {
        "code": "idea_maker",
        "name": "Fikir Üretici",
        "description": "Paylaşımların ve fikirlerinle akışa katkı sağladın.",
        "icon": "💡",
        "category": "feed",
        "required_points": 80,
    },
    {
        "code": "social_leader",
        "name": "Sosyal Lider",
        "description": "Topluluklarda aktif, görünür ve etkili bir profil oluşturdun.",
        "icon": "🏆",
        "category": "leadership",
        "required_points": 120,
    },
]


DEFAULT_CERTIFICATES = [
    {
        "code": "social_starter_certificate",
        "title": "Sosyal Başlangıç Sertifikası",
        "description": "FriendZone üzerinde ilk sosyal etkileşimlerini tamamladığını gösteren başlangıç sertifikası.",
        "category": "social",
        "icon": "🎓",
        "required_points": 50,
        "required_badge_code": "community_member",
        "issuer_name": "FriendZone",
        "certificate_type": "social_achievement",
    },
    {
        "code": "community_active_certificate",
        "title": "Topluluk Aktifliği Sertifikası",
        "description": "Topluluklara katılım, paylaşım ve etkileşimlerle sosyal gelişimini güçlendirdiğini gösterir.",
        "category": "community",
        "icon": "🌐",
        "required_points": 90,
        "required_badge_code": "idea_maker",
        "issuer_name": "FriendZone",
        "certificate_type": "community_engagement",
    },
    {
        "code": "event_organizer_certificate",
        "title": "Etkinlik ve Organizasyon Sertifikası",
        "description": "Etkinlik oluşturma, katılım sağlama ve topluluk içinde organizasyon becerilerini geliştirdiğini gösterir.",
        "category": "event",
        "icon": "📅",
        "required_points": 120,
        "required_badge_code": "social_leader",
        "issuer_name": "FriendZone",
        "certificate_type": "event_organization",
    },
    {
        "code": "social_leader_certificate",
        "title": "Sosyal Liderlik Sertifikası",
        "description": "FriendZone içinde yüksek sosyal etkileşim, topluluk katkısı ve görünürlük seviyesine ulaştığını gösterir.",
        "category": "leadership",
        "icon": "🏆",
        "required_points": 200,
        "required_badge_code": "social_leader",
        "issuer_name": "FriendZone",
        "certificate_type": "social_leadership",
    },
]


POINT_RULES = {
    "profile_view": 1,
    "profile_completed": 10,
    "feed_post_created": 8,
    "feed_comment_created": 4,
    "feed_post_liked": 2,
    "community_joined": 12,
    "community_created": 20,
    "event_joined": 10,
    "event_created": 18,
    "event_review_created": 8,
    "sponsor_added": 12,
    "member_role_updated": 6,
}


def calculate_level(total_points: int) -> str:
    """
    Calculate user level by total points.
    """

    if total_points >= 200:
        return "Sosyal Elçi"

    if total_points >= 120:
        return "Sosyal Lider"

    if total_points >= 80:
        return "Topluluk Aktifi"

    if total_points >= 45:
        return "Yükselen Profil"

    if total_points >= 20:
        return "Sosyal Başlangıç"

    return "Başlangıç Seviyesi"


def get_or_create_user_point(user_id: int) -> UserPoint:
    """
    Return existing UserPoint row or create a new one.
    """

    user_point = UserPoint.query.filter_by(user_id=user_id).first()

    if user_point:
        return user_point

    user_point = UserPoint(
        user_id=user_id,
        total_points=0,
        level=calculate_level(0),
    )

    db.session.add(user_point)
    db.session.flush()

    return user_point


def seed_default_badges() -> list[Badge]:
    """
    Create default badges if they do not exist.
    """

    created_or_existing = []

    for item in DEFAULT_BADGES:
        badge = Badge.query.filter_by(code=item["code"]).first()

        if not badge:
            badge = Badge(
                code=item["code"],
                name=item["name"],
                description=item["description"],
                icon=item["icon"],
                category=item["category"],
                required_points=item["required_points"],
                is_active=True,
            )

            db.session.add(badge)

        created_or_existing.append(badge)

    db.session.commit()

    return created_or_existing


def seed_default_certificates() -> list[Certificate]:
    """
    Create default certificates if they do not exist.
    """

    created_or_existing = []

    for item in DEFAULT_CERTIFICATES:
        certificate = Certificate.query.filter_by(code=item["code"]).first()

        if not certificate:
            certificate = Certificate(
                code=item["code"],
                title=item["title"],
                description=item["description"],
                category=item["category"],
                icon=item["icon"],
                required_points=item["required_points"],
                required_badge_code=item["required_badge_code"],
                issuer_name=item["issuer_name"],
                certificate_type=item["certificate_type"],
                is_active=True,
            )

            db.session.add(certificate)

        created_or_existing.append(certificate)

    db.session.commit()

    return created_or_existing


def award_badges_if_eligible(user_id: int) -> list[UserBadge]:
    """
    Award active badges when user reaches required points.
    """

    user_point = get_or_create_user_point(user_id)

    badges = Badge.query.filter_by(is_active=True).order_by(Badge.required_points.asc()).all()

    awarded_badges = []

    for badge in badges:
        if user_point.total_points < badge.required_points:
            continue

        existing = UserBadge.query.filter_by(
            user_id=user_id,
            badge_id=badge.id,
        ).first()

        if existing:
            continue

        user_badge = UserBadge(
            user_id=user_id,
            badge_id=badge.id,
        )

        db.session.add(user_badge)
        awarded_badges.append(user_badge)

    if awarded_badges:
        db.session.commit()

    return awarded_badges


def user_has_badge_code(user_id: int, badge_code: str | None) -> bool:
    """
    Check whether user owns a badge by code.
    """

    if not badge_code:
        return True

    badge = Badge.query.filter_by(code=badge_code, is_active=True).first()

    if not badge:
        return False

    return UserBadge.query.filter_by(
        user_id=user_id,
        badge_id=badge.id,
    ).first() is not None


def generate_certificate_number(user_id: int, certificate_code: str) -> str:
    """
    Generate unique certificate number.
    """

    short_uuid = uuid.uuid4().hex[:8].upper()
    safe_code = certificate_code.upper().replace("-", "_")

    return f"FZ-{safe_code}-{user_id}-{short_uuid}"


def award_certificates_if_eligible(user_id: int) -> list[UserCertificate]:
    """
    Award active certificates when user reaches requirements.
    """

    seed_default_certificates()

    user_point = get_or_create_user_point(user_id)

    certificates = (
        Certificate.query
        .filter_by(is_active=True)
        .order_by(Certificate.required_points.asc())
        .all()
    )

    awarded_certificates = []

    for certificate in certificates:
        if user_point.total_points < certificate.required_points:
            continue

        if not user_has_badge_code(user_id, certificate.required_badge_code):
            continue

        existing = UserCertificate.query.filter_by(
            user_id=user_id,
            certificate_id=certificate.id,
        ).first()

        if existing:
            continue

        user_certificate = UserCertificate(
            user_id=user_id,
            certificate_id=certificate.id,
            certificate_number=generate_certificate_number(user_id, certificate.code),
        )

        db.session.add(user_certificate)
        awarded_certificates.append(user_certificate)

    if awarded_certificates:
        db.session.commit()

    return awarded_certificates


def add_points(
    user_id: int,
    action_type: str,
    points: int | None = None,
    description: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    allow_duplicate: bool = True,
) -> dict:
    """
    Add social points to user.

    If allow_duplicate=False, the same action/reference pair is only counted once.
    """

    seed_default_badges()
    seed_default_certificates()

    if points is None:
        points = POINT_RULES.get(action_type, 0)

    points = int(points or 0)

    if points == 0:
        user_point = get_or_create_user_point(user_id)
        return {
            "user_point": user_point.to_dict(),
            "transaction": None,
            "awarded_badges": [],
            "awarded_certificates": [],
        }

    user_point = get_or_create_user_point(user_id)

    if not allow_duplicate and reference_type and reference_id:
        existing_transaction = UserPointTransaction.query.filter_by(
            user_id=user_id,
            action_type=action_type,
            reference_type=reference_type,
            reference_id=reference_id,
        ).first()

        if existing_transaction:
            return {
                "user_point": user_point.to_dict(),
                "transaction": existing_transaction.to_dict(),
                "awarded_badges": [],
                "awarded_certificates": [],
                "duplicate_skipped": True,
            }

    user_point.total_points = max(0, user_point.total_points + points)
    user_point.level = calculate_level(user_point.total_points)

    transaction = UserPointTransaction(
        user_point_id=user_point.id,
        user_id=user_id,
        action_type=action_type,
        points=points,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )

    db.session.add(transaction)
    db.session.commit()

    awarded_badges = award_badges_if_eligible(user_id)
    awarded_certificates = award_certificates_if_eligible(user_id)

    return {
        "user_point": user_point.to_dict(),
        "transaction": transaction.to_dict(),
        "awarded_badges": [item.to_dict() for item in awarded_badges],
        "awarded_certificates": [item.to_dict() for item in awarded_certificates],
        "duplicate_skipped": False,
    }


def get_user_badges(user_id: int) -> list[dict]:
    """
    Return all active badges with earned status.
    """

    seed_default_badges()

    all_badges = Badge.query.filter_by(is_active=True).order_by(Badge.required_points.asc()).all()

    earned_badges = UserBadge.query.filter_by(user_id=user_id).all()

    earned_map = {
        user_badge.badge_id: user_badge
        for user_badge in earned_badges
    }

    data = []

    for badge in all_badges:
        earned = badge.id in earned_map
        earned_at = None

        if earned:
            earned_at = earned_map[badge.id].earned_at.isoformat() if earned_map[badge.id].earned_at else None

        data.append(
            badge.to_dict(
                earned=earned,
                earned_at=earned_at,
            )
        )

    return data


def get_user_certificates(user_id: int) -> list[dict]:
    """
    Return all active certificates with earned status.
    """

    seed_default_certificates()

    all_certificates = (
        Certificate.query
        .filter_by(is_active=True)
        .order_by(Certificate.required_points.asc())
        .all()
    )

    earned_certificates = UserCertificate.query.filter_by(user_id=user_id).all()

    earned_map = {
        user_certificate.certificate_id: user_certificate
        for user_certificate in earned_certificates
    }

    data = []

    for certificate in all_certificates:
        earned = certificate.id in earned_map
        earned_at = None
        certificate_number = None

        if earned:
            earned_at = earned_map[certificate.id].earned_at.isoformat() if earned_map[certificate.id].earned_at else None
            certificate_number = earned_map[certificate.id].certificate_number

        data.append(
            certificate.to_dict(
                earned=earned,
                earned_at=earned_at,
                certificate_number=certificate_number,
            )
        )

    return data


def get_recent_transactions(user_id: int, limit: int = 10) -> list[dict]:
    """
    Return recent point transactions.
    """

    transactions = (
        UserPointTransaction.query
        .filter_by(user_id=user_id)
        .order_by(UserPointTransaction.created_at.desc())
        .limit(limit)
        .all()
    )

    return [transaction.to_dict() for transaction in transactions]


def get_next_badge(user_point: UserPoint) -> Badge | None:
    """
    Return next locked badge.
    """

    return (
        Badge.query
        .filter(
            Badge.is_active.is_(True),
            Badge.required_points > user_point.total_points,
        )
        .order_by(Badge.required_points.asc())
        .first()
    )


def calculate_progress_to_next_badge(user_point: UserPoint, next_badge: Badge | None) -> int | None:
    """
    Calculate progress percentage to next badge.
    """

    if not next_badge:
        return None

    previous_required = 0

    previous_badge = (
        Badge.query
        .filter(
            Badge.is_active.is_(True),
            Badge.required_points <= user_point.total_points,
        )
        .order_by(Badge.required_points.desc())
        .first()
    )

    if previous_badge:
        previous_required = previous_badge.required_points

    denominator = max(1, next_badge.required_points - previous_required)
    numerator = max(0, user_point.total_points - previous_required)

    return round((numerator / denominator) * 100)


def get_gamification_summary(user_id: int) -> dict:
    """
    Return complete gamification summary for profile.
    """

    seed_default_badges()
    seed_default_certificates()

    user_point = get_or_create_user_point(user_id)

    db.session.commit()

    award_badges_if_eligible(user_id)
    award_certificates_if_eligible(user_id)

    user_point = get_or_create_user_point(user_id)

    next_badge = get_next_badge(user_point)
    progress_to_next_badge = calculate_progress_to_next_badge(user_point, next_badge)

    return {
        "points": user_point.to_dict(),
        "badges": get_user_badges(user_id),
        "certificates": get_user_certificates(user_id),
        "recent_transactions": get_recent_transactions(user_id),
        "next_badge": next_badge.to_dict() if next_badge else None,
        "progress_to_next_badge": progress_to_next_badge,
    }