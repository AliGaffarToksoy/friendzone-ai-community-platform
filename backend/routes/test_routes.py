"""
Routes for personality and hobby tests.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database.db_connection import db
from backend.models.user_model import User
from backend.utils.helpers import success_response, error_response, compute_mbti
from backend.ml.community_assigner import assign_user_to_best_community


test_bp = Blueprint("test", __name__)

@test_bp.route("/personality", methods=["POST"])
@jwt_required()
def submit_personality() -> tuple:
    """
    Handle submission of the 24-question MBTI-style personality test.
    """
    data = request.get_json() or {}
    answers = data.get("answers")

    if not isinstance(answers, list) or len(answers) != 24:
        return error_response(
            "Lütfen 24 sorunun tamamını cevaplayın.",
            status_code=422
        )
    try:
        parsed_answers = [int(answer) for answer in answers]
        mbti = compute_mbti(parsed_answers)
    except Exception as exc:
        return error_response(
            "Kişilik tipi hesaplanamadı.",
            error=str(exc),
            status_code=400
        )

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    user.personality_type = mbti
    user.is_test_completed = True

    db.session.commit()

    return success_response(
        "Kişilik testi kaydedildi.",
        {
            "personality_type": mbti
        }
    )


@test_bp.route("/hobbies", methods=["GET"])
def get_hobby_categories() -> tuple:
    """
    Return expanded hobby categories and activities.
    """

    categories = {
        "Teknoloji": [
            "Yapay Zeka",
            "Makine Öğrenmesi",
            "Web Geliştirme",
            "Mobil Uygulama",
            "Siber Güvenlik",
            "Oyun Geliştirme",
            "Robotik",
            "Veri Bilimi",
            "Cloud Computing",
            "DevOps",
            "Linux",
            "Blockchain"
        ],
        "Spor": [
            "Futbol",
            "Basketbol",
            "Voleybol",
            "Fitness",
            "Koşu",
            "Yüzme",
            "Tenis",
            "Masa Tenisi",
            "Bisiklet",
            "Yoga",
            "Doğa Yürüyüşü",
            "Dövüş Sporları"
        ],
        "Sanat": [
            "Fotoğrafçılık",
            "Müzik",
            "Gitar",
            "Piyano",
            "Resim",
            "Dijital Tasarım",
            "Tiyatro",
            "Sinema",
            "Kısa Film",
            "Dans",
            "Yaratıcı Yazarlık",
            "Grafik Tasarım"
        ],
        "Doğa": [
            "Kamp",
            "Trekking",
            "Bisiklet",
            "Doğa Fotoğrafçılığı",
            "Balıkçılık",
            "Dağcılık",
            "Kuş Gözlemciliği",
            "Ekoloji",
            "Sürdürülebilirlik",
            "Bahçecilik",
            "Deniz Aktiviteleri",
            "Outdoor Etkinlikler"
        ],
        "Eğitim": [
            "Kitap Okuma",
            "Dil Öğrenme",
            "Akademik Araştırma",
            "Matematik",
            "Fizik",
            "Psikoloji",
            "Tarih",
            "Felsefe",
            "Ekonomi",
            "Sunum Yapma",
            "Makale Okuma",
            "Sertifika Programları"
        ],
        "Sosyal": [
            "Etkinlik Organizasyonu",
            "Gönüllülük",
            "Kulüp Yönetimi",
            "Sohbet",
            "Networking",
            "Mentorluk",
            "Takım Çalışması",
            "Kampüs Etkinlikleri",
            "Sosyal Sorumluluk",
            "Tanışma Etkinlikleri",
            "Liderlik",
            "Topluluk Kurma"
        ],
        "Kariyer": [
            "Girişimcilik",
            "Startup",
            "Ürün Yönetimi",
            "Proje Yönetimi",
            "CV Hazırlama",
            "Mülakat Hazırlığı",
            "LinkedIn Geliştirme",
            "Finans",
            "Pazarlama",
            "Satış",
            "İş Analizi",
            "Freelance Çalışma"
        ],
        "Oyun ve Eğlence": [
            "Video Oyunları",
            "E-Spor",
            "Masa Oyunları",
            "Satranç",
            "FRP",
            "Kutu Oyunları",
            "Anime",
            "Manga",
            "Podcast",
            "Stand-up",
            "Quiz Geceleri",
            "Film Geceleri"
        ],
        "Sağlık ve Yaşam": [
            "Meditasyon",
            "Sağlıklı Beslenme",
            "Mental Sağlık",
            "Kişisel Gelişim",
            "Zaman Yönetimi",
            "Uyku Düzeni",
            "Minimalizm",
            "Günlük Tutma",
            "Motivasyon",
            "Mindfulness",
            "Nefes Egzersizleri",
            "Verimli Çalışma"
        ]
    }

    return success_response("Hobi kategorileri getirildi.", categories)


@test_bp.route("/hobbies", methods=["POST"])
@jwt_required()
def submit_hobbies() -> tuple:
    """
    Save selected hobbies and assign user to best matching community.
    """

    data = request.get_json() or {}
    selected = data.get("hobbies")

    if not isinstance(selected, list):
        return error_response("Hobiler listesi gönderilmelidir.")

    if not (3 <= len(selected) <= 10):
        return error_response("En az 3, en fazla 10 hobi seçmelisiniz.")

    cleaned_hobbies = []

    for hobby in selected:
        hobby_text = str(hobby).strip()

        if hobby_text and hobby_text not in cleaned_hobbies:
            cleaned_hobbies.append(hobby_text)

    if not (3 <= len(cleaned_hobbies) <= 10):
        return error_response("Geçerli hobi sayısı en az 3, en fazla 10 olmalıdır.")

    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return error_response("Kullanıcı bulunamadı.", status_code=404)

    user.hobbies = cleaned_hobbies
    db.session.commit()

    community = assign_user_to_best_community(user)

    if not community:
        return error_response("Uygun topluluk bulunamadı.", status_code=500)

    return success_response(
        "Hobiler kaydedildi ve topluluk atandı.",
        {
            "community_id": community.id,
            "community_name": community.name
        }
    )