"""
GPT service for FriendZone.

This service generates community-specific suggestions using the OpenAI API.
If OPENAI_API_KEY is missing or API call fails, it returns a safe local fallback.
"""

from __future__ import annotations

import json
import os
import random
from typing import Any

from openai import OpenAI


DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


FALLBACK_SUGGESTIONS = {
    "Teknoloji": [
        "Bugün herkes üzerinde çalıştığı bir teknoloji projesini 2 cümleyle anlatsın.",
        "Mini etkinlik fikri: 30 dakikalık 'Linux komutları challenge' düzenleyin.",
        "Buz kırıcı soru: Son dönemde öğrendiğiniz en faydalı yazılım aracı neydi?",
        "Grup aktivitesi: Birlikte küçük bir GitHub projesi fikri belirleyin.",
        "Sohbet konusu: Yapay zeka kariyerleri ve yeni mezunlar için yol haritası."
    ],
    "Spor": [
        "Bu hafta birlikte yapılabilecek kısa bir koşu veya yürüyüş etkinliği planlayın.",
        "Buz kırıcı soru: En sevdiğiniz spor rutini veya antrenman alışkanlığı nedir?",
        "Mini oyun fikri: Haftalık adım sayısı challenge başlatın.",
        "Sohbet konusu: Spor motivasyonunu sürdürülebilir hale getirme yolları.",
        "Etkinlik önerisi: Kampüs içi karma takım maçı organize edin."
    ],
    "Sanat": [
        "Buz kırıcı soru: Sizi en çok etkileyen film, şarkı veya sanat eseri neydi?",
        "Mini etkinlik: Herkes son çektiği bir fotoğrafı veya yaptığı bir tasarımı paylaşsın.",
        "Sohbet konusu: Yaratıcılık tıkanıklığı nasıl aşılır?",
        "Grup fikri: Ortak bir Spotify listesi veya film listesi oluşturun.",
        "Etkinlik önerisi: Kısa film/fotoğraf temalı haftalık challenge düzenleyin."
    ],
    "Doğa": [
        "Etkinlik önerisi: Hafta sonu kısa bir doğa yürüyüşü rotası belirleyin.",
        "Buz kırıcı soru: En huzurlu hissettiğiniz açık hava deneyimi neydi?",
        "Mini oyun: Herkes favori doğa fotoğrafını paylaşsın ve hikayesini anlatsın.",
        "Sohbet konusu: Kampüs içinde sürdürülebilirlik için neler yapılabilir?",
        "Grup aktivitesi: Outdoor ekipman önerileri listesi hazırlayın."
    ],
    "Eğitim": [
        "Sohbet konusu: Verimli ders çalışma teknikleri ve kişisel rutinler.",
        "Buz kırıcı soru: Son okuduğunuz ve önerdiğiniz kitap/makale hangisi?",
        "Mini etkinlik: 45 dakikalık odak çalışma seansı planlayın.",
        "Grup fikri: Haftalık kitap veya makale tartışma grubu oluşturun.",
        "Etkinlik önerisi: Sunum pratiği ve geri bildirim oturumu düzenleyin."
    ],
    "Sosyal": [
        "Buz kırıcı soru: Üniversitede katıldığınız en iyi etkinlik hangisiydi?",
        "Etkinlik önerisi: Yeni üyeler için tanışma buluşması organize edin.",
        "Mini oyun: Herkes kendisi hakkında 2 doğru 1 yanlış bilgi paylaşsın.",
        "Sohbet konusu: Kampüste daha kapsayıcı sosyal ortam nasıl kurulur?",
        "Grup aktivitesi: Gönüllülük veya sosyal sorumluluk fikri belirleyin."
    ],
    "Kariyer": [
        "Sohbet konusu: Yeni mezunlar için etkili CV ve LinkedIn profili nasıl hazırlanır?",
        "Mini etkinlik: Herkes 30 saniyelik kendini tanıtma konuşması hazırlasın.",
        "Buz kırıcı soru: Hayalinizdeki ilk iş veya staj deneyimi nasıl olurdu?",
        "Grup aktivitesi: Teknik mülakat soruları üzerine mini çalışma oturumu yapın.",
        "Etkinlik önerisi: Mock interview eşleşmeleri oluşturun."
    ],
    "Oyun ve Eğlence": [
        "Mini oyun fikri: Haftalık oyun gecesi veya quiz gecesi planlayın.",
        "Buz kırıcı soru: En unutamadığınız oyun, anime veya film hangisi?",
        "Sohbet konusu: Oyunlarda takım iletişimi ve strateji kurma.",
        "Etkinlik önerisi: Kutu oyunu veya e-spor mini turnuvası düzenleyin.",
        "Grup aktivitesi: Ortak izleme/oyun listesi oluşturun."
    ],
    "Sağlık ve Yaşam": [
        "Sohbet konusu: Stres yönetimi ve sınav döneminde mental sağlık.",
        "Mini etkinlik: 10 dakikalık mindfulness veya nefes egzersizi deneyin.",
        "Buz kırıcı soru: Kendinizi iyi hissettiren küçük günlük alışkanlığınız nedir?",
        "Grup aktivitesi: Haftalık uyku/odak rutini challenge başlatın.",
        "Etkinlik önerisi: Verimli çalışma ve mola planı paylaşım oturumu düzenleyin."
    ],
    "Genel": [
        "Buz kırıcı soru: Bugün seni en çok motive eden şey neydi?",
        "Mini oyun: Herkes kendini 3 emojiyle anlatsın.",
        "Sohbet konusu: Üniversite hayatında yeni arkadaşlık kurmanın yolları.",
        "Etkinlik önerisi: Kısa bir online tanışma oturumu düzenleyin.",
        "Grup aktivitesi: Ortak ilgi alanları listesi çıkarın."
    ],
}


def generate_community_suggestions(
    community_name: str | None = None,
    category: str | None = None,
    member_count: int | None = None,
    recent_messages: list[str] | None = None,
) -> dict[str, Any]:
    """
    Generate community suggestions using OpenAI if API key exists.

    Returns a dict:
    {
      "source": "openai" | "fallback",
      "model": "...",
      "suggestions": [...]
    }
    """

    api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if not api_key:
      return _fallback_response(category)

    try:
        client = OpenAI(api_key=api_key)

        prompt = _build_prompt(
            community_name=community_name,
            category=category,
            member_count=member_count,
            recent_messages=recent_messages or [],
        )

        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Sen FriendZone adlı üniversite sosyal topluluk platformunun "
                        "AI grup asistanısın. Türkçe, kısa, uygulanabilir, güvenli ve "
                        "öğrenci dostu öneriler üret. Çıktıyı sadece JSON olarak ver."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.8,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)

        suggestions = parsed.get("suggestions", [])

        if not isinstance(suggestions, list):
            return _fallback_response(category)

        cleaned = [
            str(item).strip()
            for item in suggestions
            if str(item).strip()
        ][:5]

        if len(cleaned) < 3:
            return _fallback_response(category)

        return {
            "source": "openai",
            "model": DEFAULT_MODEL,
            "suggestions": cleaned,
        }

    except Exception as exc:
        fallback = _fallback_response(category)
        fallback["error"] = str(exc)
        return fallback


def _build_prompt(
    community_name: str | None,
    category: str | None,
    member_count: int | None,
    recent_messages: list[str],
) -> str:
    recent_context = "\n".join(
        f"- {message[:180]}"
        for message in recent_messages[-8:]
        if message
    )

    if not recent_context:
        recent_context = "Henüz kayda değer sohbet geçmişi yok."

    return f"""
Topluluk adı: {community_name or "Bilinmeyen Topluluk"}
Kategori: {category or "Genel"}
Yaklaşık üye sayısı: {member_count if member_count is not None else "Bilinmiyor"}

Son sohbet bağlamı:
{recent_context}

Bu topluluk için 5 adet öneri üret:
1. Bir sohbet konusu
2. Bir etkinlik fikri
3. Bir buz kırıcı soru
4. Bir mini oyun veya challenge
5. Kategoriye uygun bir grup aktivitesi

Kurallar:
- Türkçe yaz.
- Her öneri tek cümle olsun.
- Üniversite öğrencilerine uygun olsun.
- Güvenli, saygılı ve uygulanabilir olsun.
- Cevabı sadece şu JSON formatında ver:
{{
  "suggestions": [
    "öneri 1",
    "öneri 2",
    "öneri 3",
    "öneri 4",
    "öneri 5"
  ]
}}
""".strip()


def _fallback_response(category: str | None) -> dict[str, Any]:
    category_key = category if category in FALLBACK_SUGGESTIONS else "Genel"
    pool = FALLBACK_SUGGESTIONS.get(category_key, FALLBACK_SUGGESTIONS["Genel"])
    suggestions = random.sample(pool, k=min(5, len(pool)))

    return {
        "source": "fallback",
        "model": None,
        "suggestions": suggestions,
    }