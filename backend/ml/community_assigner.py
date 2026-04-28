"""
Advanced community assignment engine.

This module assigns users to the most suitable community using a weighted score:

- Hobby/tag similarity: 60%
- Category affinity: 20%
- Personality compatibility: 20%

The first MVP version only performed direct tag matching. This version is more
portfolio-ready and better represents the "AI-supported matching" idea.
"""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Optional

from sqlalchemy import func

from backend.database.db_connection import db
from backend.models.user_model import User
from backend.models.community_model import Community, CommunityMember


@dataclass
class MatchBreakdown:
    hobby_score: float
    category_score: float
    personality_score: float
    total_score: float


PERSONALITY_CATEGORY_AFFINITY: dict[str, list[str]] = {
    "INTJ": ["Teknoloji", "Eğitim", "Kariyer"],
    "INTP": ["Teknoloji", "Eğitim", "Oyun ve Eğlence"],
    "ENTJ": ["Kariyer", "Sosyal", "Teknoloji"],
    "ENTP": ["Kariyer", "Teknoloji", "Sosyal"],

    "INFJ": ["Sosyal", "Eğitim", "Sağlık ve Yaşam"],
    "INFP": ["Sanat", "Doğa", "Eğitim"],
    "ENFJ": ["Sosyal", "Eğitim", "Kariyer"],
    "ENFP": ["Sosyal", "Sanat", "Oyun ve Eğlence"],

    "ISTJ": ["Eğitim", "Teknoloji", "Kariyer"],
    "ISFJ": ["Sosyal", "Sağlık ve Yaşam", "Eğitim"],
    "ESTJ": ["Kariyer", "Sosyal", "Spor"],
    "ESFJ": ["Sosyal", "Sağlık ve Yaşam", "Sanat"],

    "ISTP": ["Teknoloji", "Spor", "Doğa"],
    "ISFP": ["Sanat", "Doğa", "Sağlık ve Yaşam"],
    "ESTP": ["Spor", "Sosyal", "Kariyer"],
    "ESFP": ["Sosyal", "Sanat", "Oyun ve Eğlence"],
}


HOBBY_CATEGORY_MAP: dict[str, str] = {
    # Teknoloji
    "yapay zeka": "Teknoloji",
    "makine öğrenmesi": "Teknoloji",
    "web geliştirme": "Teknoloji",
    "mobil uygulama": "Teknoloji",
    "siber güvenlik": "Teknoloji",
    "oyun geliştirme": "Teknoloji",
    "robotik": "Teknoloji",
    "veri bilimi": "Teknoloji",
    "cloud computing": "Teknoloji",
    "devops": "Teknoloji",
    "linux": "Teknoloji",
    "blockchain": "Teknoloji",

    # Spor
    "futbol": "Spor",
    "basketbol": "Spor",
    "voleybol": "Spor",
    "fitness": "Spor",
    "koşu": "Spor",
    "yüzme": "Spor",
    "tenis": "Spor",
    "masa tenisi": "Spor",
    "bisiklet": "Spor",
    "yoga": "Spor",
    "doğa yürüyüşü": "Spor",
    "dövüş sporları": "Spor",

    # Sanat
    "fotoğrafçılık": "Sanat",
    "müzik": "Sanat",
    "gitar": "Sanat",
    "piyano": "Sanat",
    "resim": "Sanat",
    "dijital tasarım": "Sanat",
    "tiyatro": "Sanat",
    "sinema": "Sanat",
    "kısa film": "Sanat",
    "dans": "Sanat",
    "yaratıcı yazarlık": "Sanat",
    "grafik tasarım": "Sanat",

    # Doğa
    "kamp": "Doğa",
    "trekking": "Doğa",
    "doğa fotoğrafçılığı": "Doğa",
    "balıkçılık": "Doğa",
    "dağcılık": "Doğa",
    "kuş gözlemciliği": "Doğa",
    "ekoloji": "Doğa",
    "sürdürülebilirlik": "Doğa",
    "bahçecilik": "Doğa",
    "deniz aktiviteleri": "Doğa",
    "outdoor etkinlikler": "Doğa",

    # Eğitim
    "kitap okuma": "Eğitim",
    "dil öğrenme": "Eğitim",
    "akademik araştırma": "Eğitim",
    "matematik": "Eğitim",
    "fizik": "Eğitim",
    "psikoloji": "Eğitim",
    "tarih": "Eğitim",
    "felsefe": "Eğitim",
    "ekonomi": "Eğitim",
    "sunum yapma": "Eğitim",
    "makale okuma": "Eğitim",
    "sertifika programları": "Eğitim",

    # Sosyal
    "etkinlik organizasyonu": "Sosyal",
    "gönüllülük": "Sosyal",
    "kulüp yönetimi": "Sosyal",
    "sohbet": "Sosyal",
    "networking": "Sosyal",
    "mentorluk": "Sosyal",
    "takım çalışması": "Sosyal",
    "kampüs etkinlikleri": "Sosyal",
    "sosyal sorumluluk": "Sosyal",
    "tanışma etkinlikleri": "Sosyal",
    "liderlik": "Sosyal",
    "topluluk kurma": "Sosyal",

    # Kariyer
    "girişimcilik": "Kariyer",
    "startup": "Kariyer",
    "ürün yönetimi": "Kariyer",
    "proje yönetimi": "Kariyer",
    "cv hazırlama": "Kariyer",
    "mülakat hazırlığı": "Kariyer",
    "linkedin geliştirme": "Kariyer",
    "finans": "Kariyer",
    "pazarlama": "Kariyer",
    "satış": "Kariyer",
    "iş analizi": "Kariyer",
    "freelance çalışma": "Kariyer",

    # Oyun ve Eğlence
    "video oyunları": "Oyun ve Eğlence",
    "e-spor": "Oyun ve Eğlence",
    "masa oyunları": "Oyun ve Eğlence",
    "satranç": "Oyun ve Eğlence",
    "frp": "Oyun ve Eğlence",
    "kutu oyunları": "Oyun ve Eğlence",
    "anime": "Oyun ve Eğlence",
    "manga": "Oyun ve Eğlence",
    "podcast": "Oyun ve Eğlence",
    "stand-up": "Oyun ve Eğlence",
    "quiz geceleri": "Oyun ve Eğlence",
    "film geceleri": "Oyun ve Eğlence",

    # Sağlık ve Yaşam
    "meditasyon": "Sağlık ve Yaşam",
    "sağlıklı beslenme": "Sağlık ve Yaşam",
    "mental sağlık": "Sağlık ve Yaşam",
    "kişisel gelişim": "Sağlık ve Yaşam",
    "zaman yönetimi": "Sağlık ve Yaşam",
    "uyku düzeni": "Sağlık ve Yaşam",
    "minimalizm": "Sağlık ve Yaşam",
    "günlük tutma": "Sağlık ve Yaşam",
    "motivasyon": "Sağlık ve Yaşam",
    "mindfulness": "Sağlık ve Yaşam",
    "nefes egzersizleri": "Sağlık ve Yaşam",
    "verimli çalışma": "Sağlık ve Yaşam",
}


def assign_user_to_best_community(user: User) -> Optional[Community]:
    """
    Assign the user to the best matching active community.

    If no meaningful match is found, the user is assigned to "Genel Sohbet".
    """

    communities = Community.query.filter_by(is_active=True).all()

    if not communities:
        return _assign_to_general_chat(user)

    best_community: Optional[Community] = None
    best_breakdown: Optional[MatchBreakdown] = None

    for community in communities:
        breakdown = calculate_community_match(user, community)

        if best_breakdown is None or breakdown.total_score > best_breakdown.total_score:
            best_community = community
            best_breakdown = breakdown

    if not best_community or not best_breakdown:
        return _assign_to_general_chat(user)

    if best_breakdown.total_score <= 0:
        return _assign_to_general_chat(user)

    _add_user_to_community(user, best_community)
    return best_community


def calculate_community_match(user: User, community: Community) -> MatchBreakdown:
    """
    Calculate a detailed compatibility score for a user-community pair.

    Returns:
        MatchBreakdown with score components in the 0-100 range.
    """

    hobby_score = _calculate_hobby_tag_score(user.hobbies or [], community.tags or [])
    category_score = _calculate_category_score(user.hobbies or [], community.category)
    personality_score = _calculate_personality_score(user.personality_type, community.category, community.tags or [])

    total_score = (
        hobby_score * 0.60 +
        category_score * 0.20 +
        personality_score * 0.20
    )

    return MatchBreakdown(
        hobby_score=round(hobby_score, 2),
        category_score=round(category_score, 2),
        personality_score=round(personality_score, 2),
        total_score=round(total_score, 2),
    )


def _calculate_hobby_tag_score(user_hobbies: list[str], community_tags: list[str]) -> float:
    """
    Calculate fuzzy hobby/tag similarity score between 0 and 100.

    Supports:
    - exact match
    - partial contains match
    - fuzzy string similarity
    """

    if not user_hobbies or not community_tags:
        return 0.0

    normalized_hobbies = [_normalize_text(hobby) for hobby in user_hobbies]
    normalized_tags = [_normalize_text(tag) for tag in community_tags]

    total_possible = len(normalized_hobbies) * 100
    actual_score = 0.0

    for hobby in normalized_hobbies:
        best_single_score = 0.0

        for tag in normalized_tags:
            if hobby == tag:
                best_single_score = max(best_single_score, 100.0)
            elif hobby in tag or tag in hobby:
                best_single_score = max(best_single_score, 78.0)
            else:
                similarity = SequenceMatcher(None, hobby, tag).ratio()

                if similarity >= 0.88:
                    best_single_score = max(best_single_score, 72.0)
                elif similarity >= 0.74:
                    best_single_score = max(best_single_score, 55.0)
                elif similarity >= 0.62:
                    best_single_score = max(best_single_score, 35.0)

        actual_score += best_single_score

    if total_possible == 0:
        return 0.0

    return min(100.0, (actual_score / total_possible) * 100)


def _calculate_category_score(user_hobbies: list[str], community_category: str | None) -> float:
    """
    Calculate how well user's hobbies map to the community category.
    """

    if not user_hobbies or not community_category:
        return 0.0

    target_category = _normalize_text(community_category)
    matching_count = 0

    for hobby in user_hobbies:
        hobby_category = HOBBY_CATEGORY_MAP.get(_normalize_text(hobby))

        if hobby_category and _normalize_text(hobby_category) == target_category:
            matching_count += 1

    return min(100.0, (matching_count / len(user_hobbies)) * 100)


def _calculate_personality_score(
    personality_type: str | None,
    community_category: str | None,
    community_tags: list[str],
) -> float:
    """
    Score personality-category compatibility.
    """

    if not personality_type:
        return 50.0

    personality = personality_type.upper().strip()
    preferred_categories = PERSONALITY_CATEGORY_AFFINITY.get(personality, [])

    if not preferred_categories:
        return 50.0

    category_score = 0.0

    if community_category:
        normalized_category = _normalize_text(community_category)

        for index, preferred in enumerate(preferred_categories):
            if _normalize_text(preferred) == normalized_category:
                category_score = max(category_score, 100 - (index * 15))

    tag_score = 0.0
    normalized_tags = [_normalize_text(tag) for tag in community_tags]

    personality_keywords = _personality_keywords(personality)

    for keyword in personality_keywords:
        normalized_keyword = _normalize_text(keyword)

        for tag in normalized_tags:
            if normalized_keyword == tag or normalized_keyword in tag or tag in normalized_keyword:
                tag_score = max(tag_score, 85.0)

    if category_score == 0 and tag_score == 0:
        return 35.0

    return min(100.0, max(category_score, tag_score))


def _personality_keywords(personality: str) -> list[str]:
    keyword_map = {
        "INTJ": ["strateji", "yapay zeka", "akademik araştırma", "veri bilimi", "proje"],
        "INTP": ["araştırma", "yapay zeka", "bilim", "matematik", "yazılım"],
        "ENTJ": ["liderlik", "girişimcilik", "proje yönetimi", "startup"],
        "ENTP": ["startup", "inovasyon", "tartışma", "girişimcilik"],

        "INFJ": ["gönüllülük", "sosyal sorumluluk", "psikoloji", "mentorluk"],
        "INFP": ["sanat", "yaratıcı yazarlık", "müzik", "felsefe"],
        "ENFJ": ["mentorluk", "liderlik", "sosyal sorumluluk", "topluluk"],
        "ENFP": ["etkinlik", "networking", "yaratıcılık", "sanat"],

        "ISTJ": ["akademik araştırma", "planlama", "verimli çalışma", "proje"],
        "ISFJ": ["gönüllülük", "sağlık", "yardımlaşma", "sosyal"],
        "ESTJ": ["kulüp yönetimi", "liderlik", "organizasyon", "proje yönetimi"],
        "ESFJ": ["sosyal", "etkinlik", "gönüllülük", "topluluk"],

        "ISTP": ["robotik", "linux", "siber güvenlik", "spor"],
        "ISFP": ["fotoğrafçılık", "resim", "doğa", "müzik"],
        "ESTP": ["spor", "etkinlik", "girişimcilik", "aksiyon"],
        "ESFP": ["dans", "müzik", "film geceleri", "sosyal"],
    }

    return keyword_map.get(personality, [])


def _add_user_to_community(user: User, community: Community) -> None:
    """
    Add user to community if not already a member.
    """

    existing_membership = CommunityMember.query.filter_by(
        user_id=user.id,
        community_id=community.id,
    ).first()

    if existing_membership:
        if not existing_membership.is_active:
            existing_membership.is_active = True
            db.session.commit()

        return

    membership = CommunityMember(
        user_id=user.id,
        community_id=community.id,
        role="member",
        is_active=True,
    )

    db.session.add(membership)
    db.session.commit()


def _assign_to_general_chat(user: User) -> Community:
    """
    Assign user to default "Genel Sohbet" community.
    """

    community = Community.query.filter(
        func.lower(Community.name) == "genel sohbet"
    ).first()

    if not community:
        community = Community(
            name="Genel Sohbet",
            description="Tüm öğrencilerin katılabildiği genel sohbet topluluğu.",
            category="Genel",
            tags=["genel", "sohbet", "tanışma", "kampüs", "sosyal"],
            max_members=1000,
            is_active=True,
        )

        db.session.add(community)
        db.session.commit()

    _add_user_to_community(user, community)
    return community


def _normalize_text(value: str) -> str:
    """
    Normalize Turkish text for better matching.
    """

    if value is None:
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