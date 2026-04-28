"""
Seed data for FriendZone.

Run with:
    python -m backend.database.seed_data

This script creates a rich set of demo communities and demo users.
It is safe to run multiple times; existing communities/users are skipped.
"""

from __future__ import annotations

from backend import create_app
from backend.database.db_connection import db
from backend.models.user_model import User
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_room_model import ChatRoom


COMMUNITIES = [
    {
        "name": "Genel Sohbet",
        "description": "Tüm öğrencilerin tanışabileceği, gündelik konular üzerine sohbet edebileceği ana topluluk.",
        "category": "Genel",
        "tags": ["genel", "sohbet", "tanışma", "kampüs", "networking", "sosyal"],
        "max_members": 1000,
    },
    {
        "name": "Yapay Zeka ve Veri Bilimi",
        "description": "Yapay zeka, makine öğrenmesi, veri bilimi ve Python projeleri üzerine çalışan öğrenciler için topluluk.",
        "category": "Teknoloji",
        "tags": ["yapay zeka", "makine öğrenmesi", "veri bilimi", "python", "akademik araştırma", "matematik"],
        "max_members": 300,
    },
    {
        "name": "Cloud & DevOps Kulübü",
        "description": "Cloud computing, Linux, Docker, Kubernetes, CI/CD ve modern deployment süreçlerini öğrenmek isteyenler için.",
        "category": "Teknoloji",
        "tags": ["cloud computing", "devops", "linux", "docker", "kubernetes", "ci/cd", "proje yönetimi"],
        "max_members": 250,
    },
    {
        "name": "Siber Güvenlik Topluluğu",
        "description": "CTF, network güvenliği, Linux, web güvenliği ve etik hacking konularına ilgi duyan öğrenciler için.",
        "category": "Teknoloji",
        "tags": ["siber güvenlik", "linux", "network", "ctf", "web güvenliği", "etik hacking"],
        "max_members": 220,
    },
    {
        "name": "Web ve Mobil Geliştirme",
        "description": "Frontend, backend, mobil uygulama ve full-stack geliştirme üzerine proje yapmak isteyenler için.",
        "category": "Teknoloji",
        "tags": ["web geliştirme", "mobil uygulama", "frontend", "backend", "javascript", "python", "proje"],
        "max_members": 280,
    },
    {
        "name": "Oyun Geliştirme ve E-Spor",
        "description": "Oyun geliştirme, e-spor, video oyunları ve oyun tasarımı konularında buluşma noktası.",
        "category": "Oyun ve Eğlence",
        "tags": ["oyun geliştirme", "video oyunları", "e-spor", "unity", "game design", "kutu oyunları"],
        "max_members": 250,
    },
    {
        "name": "Startup ve Girişimcilik",
        "description": "Startup kurmak, ürün geliştirmek, iş fikri üretmek ve girişimcilik ekosistemini tanımak isteyen öğrenciler için.",
        "category": "Kariyer",
        "tags": ["girişimcilik", "startup", "ürün yönetimi", "pazarlama", "finans", "liderlik", "networking"],
        "max_members": 250,
    },
    {
        "name": "Kariyer ve Mülakat Hazırlığı",
        "description": "CV, LinkedIn, teknik mülakat, staj ve yeni mezun iş süreçlerine hazırlanan öğrenciler için.",
        "category": "Kariyer",
        "tags": ["cv hazırlama", "mülakat hazırlığı", "linkedin geliştirme", "iş analizi", "proje yönetimi", "freelance çalışma"],
        "max_members": 300,
    },
    {
        "name": "Kitap, Felsefe ve Akademik Okuma",
        "description": "Kitap okuma, felsefe, akademik araştırma ve derin tartışmalar için sakin ve üretken bir topluluk.",
        "category": "Eğitim",
        "tags": ["kitap okuma", "felsefe", "akademik araştırma", "makale okuma", "tarih", "psikoloji"],
        "max_members": 180,
    },
    {
        "name": "Dil Öğrenme ve Kültür",
        "description": "Yabancı dil öğrenmek, konuşma pratiği yapmak ve farklı kültürleri tanımak isteyen öğrenciler için.",
        "category": "Eğitim",
        "tags": ["dil öğrenme", "kültür", "konuşma pratiği", "sertifika programları", "sunum yapma"],
        "max_members": 200,
    },
    {
        "name": "Fotoğrafçılık ve Dijital Tasarım",
        "description": "Fotoğrafçılık, grafik tasarım, dijital sanat ve görsel üretimle ilgilenen öğrenciler için.",
        "category": "Sanat",
        "tags": ["fotoğrafçılık", "dijital tasarım", "grafik tasarım", "resim", "doğa fotoğrafçılığı", "yaratıcı yazarlık"],
        "max_members": 170,
    },
    {
        "name": "Müzik ve Sahne Sanatları",
        "description": "Müzik, gitar, piyano, tiyatro, dans ve sahne performanslarına ilgi duyan öğrenciler için.",
        "category": "Sanat",
        "tags": ["müzik", "gitar", "piyano", "tiyatro", "dans", "sahne", "yaratıcılık"],
        "max_members": 180,
    },
    {
        "name": "Sinema, Anime ve Film Geceleri",
        "description": "Sinema, anime, manga, kısa film ve film gecesi etkinlikleri için sosyal bir topluluk.",
        "category": "Oyun ve Eğlence",
        "tags": ["sinema", "anime", "manga", "kısa film", "film geceleri", "podcast", "stand-up"],
        "max_members": 220,
    },
    {
        "name": "Fitness ve Koşu Kulübü",
        "description": "Fitness, koşu, sağlıklı yaşam ve spor motivasyonu için birlikte hareket eden öğrenciler.",
        "category": "Spor",
        "tags": ["fitness", "koşu", "sağlıklı beslenme", "motivasyon", "zaman yönetimi", "spor"],
        "max_members": 260,
    },
    {
        "name": "Takım Sporları Topluluğu",
        "description": "Futbol, basketbol, voleybol ve takım çalışması odaklı spor aktiviteleri için.",
        "category": "Spor",
        "tags": ["futbol", "basketbol", "voleybol", "takım çalışması", "kampüs etkinlikleri", "liderlik"],
        "max_members": 280,
    },
    {
        "name": "Outdoor ve Kamp Topluluğu",
        "description": "Kamp, trekking, doğa yürüyüşü, dağcılık ve outdoor etkinlikleri seven öğrenciler için.",
        "category": "Doğa",
        "tags": ["kamp", "trekking", "doğa yürüyüşü", "dağcılık", "outdoor etkinlikler", "sürdürülebilirlik"],
        "max_members": 220,
    },
    {
        "name": "Ekoloji ve Sürdürülebilirlik",
        "description": "Ekoloji, çevre bilinci, sürdürülebilirlik ve sosyal sorumluluk projeleri üzerine çalışan öğrenciler.",
        "category": "Doğa",
        "tags": ["ekoloji", "sürdürülebilirlik", "sosyal sorumluluk", "gönüllülük", "bahçecilik", "doğa"],
        "max_members": 180,
    },
    {
        "name": "Gönüllülük ve Sosyal Sorumluluk",
        "description": "Topluma katkı sağlamak, gönüllü projelere katılmak ve sosyal etki üretmek isteyen öğrenciler için.",
        "category": "Sosyal",
        "tags": ["gönüllülük", "sosyal sorumluluk", "mentorluk", "takım çalışması", "topluluk kurma", "yardımlaşma"],
        "max_members": 240,
    },
    {
        "name": "Etkinlik ve Networking Kulübü",
        "description": "Kampüs etkinlikleri düzenlemek, yeni insanlarla tanışmak ve güçlü sosyal bağlantılar kurmak isteyenler için.",
        "category": "Sosyal",
        "tags": ["etkinlik organizasyonu", "networking", "tanışma etkinlikleri", "kulüp yönetimi", "liderlik", "sohbet"],
        "max_members": 300,
    },
    {
        "name": "Psikoloji ve Kişisel Gelişim",
        "description": "Psikoloji, mental sağlık, mindfulness, motivasyon ve kişisel gelişim konularına ilgi duyan öğrenciler için.",
        "category": "Sağlık ve Yaşam",
        "tags": ["psikoloji", "mental sağlık", "kişisel gelişim", "mindfulness", "meditasyon", "günlük tutma"],
        "max_members": 220,
    },
    {
        "name": "Verimli Çalışma ve Zaman Yönetimi",
        "description": "Ders çalışma düzeni, verimli çalışma, zaman yönetimi ve motivasyon için destek topluluğu.",
        "category": "Sağlık ve Yaşam",
        "tags": ["verimli çalışma", "zaman yönetimi", "motivasyon", "uyku düzeni", "minimalizm", "sertifika programları"],
        "max_members": 220,
    },
]


DEMO_USERS = [
    {
        "name": "Deniz Yılmaz",
        "email": "deniz.yilmaz@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Bilgisayar Mühendisliği",
        "year": "3. Sınıf",
        "bio": "Yapay zeka, veri bilimi ve Python projeleriyle ilgileniyorum.",
        "personality_type": "INTP",
        "hobbies": ["Yapay Zeka", "Veri Bilimi", "Matematik", "Akademik Araştırma", "Makine Öğrenmesi"],
    },
    {
        "name": "Ece Demir",
        "email": "ece.demir@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "İşletme",
        "year": "4. Sınıf",
        "bio": "Startup, girişimcilik ve etkinlik organizasyonu üzerine çalışıyorum.",
        "personality_type": "ENTJ",
        "hobbies": ["Girişimcilik", "Startup", "Liderlik", "Networking", "Proje Yönetimi"],
    },
    {
        "name": "Mert Kaya",
        "email": "mert.kaya@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Elektrik Elektronik Mühendisliği",
        "year": "2. Sınıf",
        "bio": "Siber güvenlik, Linux ve CTF konularını öğreniyorum.",
        "personality_type": "ISTP",
        "hobbies": ["Siber Güvenlik", "Linux", "Robotik", "DevOps", "Cloud Computing"],
    },
    {
        "name": "Zeynep Aydın",
        "email": "zeynep.aydin@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Psikoloji",
        "year": "3. Sınıf",
        "bio": "Psikoloji, gönüllülük ve sosyal sorumluluk projelerine ilgi duyuyorum.",
        "personality_type": "INFJ",
        "hobbies": ["Psikoloji", "Gönüllülük", "Sosyal Sorumluluk", "Mental Sağlık", "Mentorluk"],
    },
    {
        "name": "Selin Arslan",
        "email": "selin.arslan@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Güzel Sanatlar",
        "year": "2. Sınıf",
        "bio": "Fotoğrafçılık, dijital tasarım ve yaratıcı yazarlıkla ilgileniyorum.",
        "personality_type": "INFP",
        "hobbies": ["Fotoğrafçılık", "Dijital Tasarım", "Yaratıcı Yazarlık", "Resim", "Doğa Fotoğrafçılığı"],
    },
    {
        "name": "Can Özkan",
        "email": "can.ozkan@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Spor Bilimleri",
        "year": "1. Sınıf",
        "bio": "Fitness, koşu ve takım sporlarını seviyorum.",
        "personality_type": "ESTP",
        "hobbies": ["Fitness", "Koşu", "Futbol", "Basketbol", "Takım Çalışması"],
    },
    {
        "name": "Melis Şahin",
        "email": "melis.sahin@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "İletişim",
        "year": "4. Sınıf",
        "bio": "Sinema, etkinlikler ve sosyal medya üzerine içerik üretmeyi seviyorum.",
        "personality_type": "ENFP",
        "hobbies": ["Sinema", "Film Geceleri", "Etkinlik Organizasyonu", "Networking", "Podcast"],
    },
    {
        "name": "Burak Çelik",
        "email": "burak.celik@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "FriendZone Demo Üniversitesi",
        "department": "Endüstri Mühendisliği",
        "year": "3. Sınıf",
        "bio": "Proje yönetimi, verimli çalışma ve kariyer gelişimiyle ilgileniyorum.",
        "personality_type": "ESTJ",
        "hobbies": ["Proje Yönetimi", "Zaman Yönetimi", "CV Hazırlama", "Mülakat Hazırlığı", "Verimli Çalışma"],
    },
]


def seed_communities() -> None:
    for item in COMMUNITIES:
        existing = Community.query.filter_by(name=item["name"]).first()

        if existing:
            existing.description = item["description"]
            existing.category = item["category"]
            existing.tags = item["tags"]
            existing.max_members = item["max_members"]
            existing.is_active = True
            community = existing
        else:
            community = Community(
                name=item["name"],
                description=item["description"],
                category=item["category"],
                tags=item["tags"],
                max_members=item["max_members"],
                is_active=True,
            )

            db.session.add(community)
            db.session.flush()

        ensure_chat_room(community)

    db.session.commit()


def seed_demo_users() -> None:
    for item in DEMO_USERS:
        existing = User.query.filter_by(email=item["email"]).first()

        if existing:
            existing.name = item["name"]
            existing.university = item["university"]
            existing.department = item["department"]
            existing.year = item["year"]
            existing.bio = item["bio"]
            existing.personality_type = item["personality_type"]
            existing.hobbies = item["hobbies"]
            existing.is_test_completed = True
            existing.is_active = True
            user = existing
        else:
            user = User(
                name=item["name"],
                email=item["email"],
                password_hash=item["password_hash"],
                university=item["university"],
                department=item["department"],
                year=item["year"],
                bio=item["bio"],
                personality_type=item["personality_type"],
                hobbies=item["hobbies"],
                is_test_completed=True,
                is_active=True,
            )

            db.session.add(user)
            db.session.flush()

        assign_demo_user_to_matching_community(user)

    db.session.commit()


def assign_demo_user_to_matching_community(user: User) -> None:
    from backend.ml.community_assigner import assign_user_to_best_community

    assign_user_to_best_community(user)


def ensure_chat_room(community: Community) -> None:
    existing_room = ChatRoom.query.filter_by(community_id=community.id).first()

    if existing_room:
        existing_room.name = f"{community.name} Sohbet Odası"
        existing_room.description = f"{community.name} topluluğu için ana sohbet odası."
        existing_room.is_active = True
        existing_room.max_members = community.max_members
        return

    chat_room = ChatRoom(
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

    db.session.add(chat_room)


def main() -> None:
    app = create_app()

    with app.app_context():
        seed_communities()
        seed_demo_users()

        community_count = Community.query.count()
        user_count = User.query.count()
        room_count = ChatRoom.query.count()

        print("Seed completed successfully.")
        print(f"Communities: {community_count}")
        print(f"Users: {user_count}")
        print(f"Chat rooms: {room_count}")


if __name__ == "__main__":
    main()