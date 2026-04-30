"""
Seed data for FriendZone.

Run with:
    python -m backend.database.seed_data

This script creates a rich set of demo communities and demo users.
It is safe to run multiple times; existing communities/users are updated.
"""

from __future__ import annotations

from backend import create_app
from backend.database.db_connection import db
from backend.models.chat_room_model import ChatRoom
from backend.models.community_model import Community
from backend.models.user_model import User


COMMUNITIES = [
    {
        "name": "Genel Sohbet",
        "description": "Tüm öğrencilerin tanışabileceği, gündelik konular üzerine sohbet edebileceği ana topluluk.",
        "category": "Genel",
        "university": None,
        "city": None,
        "scope": "country",
        "tags": ["genel", "sohbet", "tanışma", "kampüs", "networking", "sosyal"],
        "max_members": 1000,
    },
    {
        "name": "BEÜN Yapay Zeka Topluluğu",
        "description": "Zonguldak Bülent Ecevit Üniversitesi öğrencileri için yapay zeka, makine öğrenmesi ve veri bilimi topluluğu.",
        "category": "Teknoloji",
        "university": "Zonguldak Bülent Ecevit Üniversitesi",
        "city": "Zonguldak",
        "scope": "university",
        "tags": ["yapay zeka", "makine öğrenmesi", "veri bilimi", "python", "akademik araştırma"],
        "max_members": 250,
    },
    {
        "name": "BEÜN Kampüs Networking",
        "description": "Zonguldak Bülent Ecevit Üniversitesi öğrencilerinin tanışması, etkinlik planlaması ve kampüs içi bağlantı kurması için.",
        "category": "Sosyal",
        "university": "Zonguldak Bülent Ecevit Üniversitesi",
        "city": "Zonguldak",
        "scope": "university",
        "tags": ["networking", "tanışma", "kampüs etkinlikleri", "sohbet", "kulüp yönetimi"],
        "max_members": 300,
    },
    {
        "name": "Zonguldak Üniversite Öğrencileri Outdoor",
        "description": "Zonguldak'taki üniversite öğrencileri için kamp, trekking, doğa yürüyüşü ve outdoor etkinlik topluluğu.",
        "category": "Doğa",
        "university": None,
        "city": "Zonguldak",
        "scope": "city",
        "tags": ["kamp", "trekking", "doğa yürüyüşü", "outdoor etkinlikler", "sürdürülebilirlik"],
        "max_members": 220,
    },
    {
        "name": "İTÜ Girişimcilik ve Startup Kulübü",
        "description": "İstanbul Teknik Üniversitesi merkezli startup, ürün geliştirme ve girişimcilik odaklı öğrenci topluluğu.",
        "category": "Kariyer",
        "university": "İstanbul Teknik Üniversitesi",
        "city": "İstanbul",
        "scope": "university",
        "tags": ["girişimcilik", "startup", "ürün yönetimi", "pazarlama", "finans", "liderlik"],
        "max_members": 300,
    },
    {
        "name": "Boğaziçi Sinema ve Film Geceleri",
        "description": "Boğaziçi Üniversitesi öğrencileri için sinema, kısa film, film geceleri ve yaratıcı tartışma topluluğu.",
        "category": "Sanat",
        "university": "Boğaziçi Üniversitesi",
        "city": "İstanbul",
        "scope": "university",
        "tags": ["sinema", "kısa film", "film geceleri", "yaratıcı yazarlık", "podcast"],
        "max_members": 220,
    },
    {
        "name": "YTÜ Siber Güvenlik Topluluğu",
        "description": "Yıldız Teknik Üniversitesi öğrencileri için CTF, Linux, network güvenliği ve etik hacking topluluğu.",
        "category": "Teknoloji",
        "university": "Yıldız Teknik Üniversitesi",
        "city": "İstanbul",
        "scope": "university",
        "tags": ["siber güvenlik", "linux", "network", "ctf", "web güvenliği", "etik hacking"],
        "max_members": 240,
    },
    {
        "name": "İstanbul Üniversiteleri Koşu Kulübü",
        "description": "İstanbul'daki farklı üniversitelerden öğrencilerin birlikte koşu, yürüyüş ve spor etkinlikleri düzenlediği şehir bazlı topluluk.",
        "category": "Spor",
        "university": None,
        "city": "İstanbul",
        "scope": "city",
        "tags": ["koşu", "fitness", "sağlıklı beslenme", "motivasyon", "takım çalışması"],
        "max_members": 350,
    },
    {
        "name": "İstanbul Üniversiteleri Etkinlik ve Networking",
        "description": "İstanbul'daki üniversite öğrencileri için şehir genelinde etkinlik, networking ve sosyal buluşma topluluğu.",
        "category": "Sosyal",
        "university": None,
        "city": "İstanbul",
        "scope": "city",
        "tags": ["etkinlik organizasyonu", "networking", "tanışma etkinlikleri", "kulüp yönetimi", "sohbet"],
        "max_members": 500,
    },
    {
        "name": "ODTÜ Robotik ve Gömülü Sistemler",
        "description": "ODTÜ öğrencileri için robotik, gömülü sistemler, elektronik ve proje geliştirme topluluğu.",
        "category": "Teknoloji",
        "university": "Orta Doğu Teknik Üniversitesi",
        "city": "Ankara",
        "scope": "university",
        "tags": ["robotik", "gömülü sistemler", "elektronik", "proje", "linux"],
        "max_members": 250,
    },
    {
        "name": "Ankara Üniversiteleri Kitap ve Felsefe",
        "description": "Ankara'daki üniversite öğrencileri için kitap okuma, felsefe, akademik araştırma ve tartışma topluluğu.",
        "category": "Eğitim",
        "university": None,
        "city": "Ankara",
        "scope": "city",
        "tags": ["kitap okuma", "felsefe", "akademik araştırma", "makale okuma", "tarih"],
        "max_members": 240,
    },
    {
        "name": "Türkiye Geneli Cloud & DevOps Network",
        "description": "Türkiye genelindeki üniversite öğrencileri için cloud computing, DevOps, Docker, Kubernetes ve CI/CD odaklı network.",
        "category": "Teknoloji",
        "university": None,
        "city": None,
        "scope": "country",
        "tags": ["cloud computing", "devops", "linux", "docker", "kubernetes", "ci/cd"],
        "max_members": 1000,
    },
    {
        "name": "Türkiye Geneli Yapay Zeka ve Veri Bilimi",
        "description": "Türkiye genelindeki öğrencilerin yapay zeka, veri bilimi ve makine öğrenmesi üzerine buluştuğu topluluk.",
        "category": "Teknoloji",
        "university": None,
        "city": None,
        "scope": "country",
        "tags": ["yapay zeka", "makine öğrenmesi", "veri bilimi", "python", "matematik"],
        "max_members": 1200,
    },
    {
        "name": "Türkiye Geneli Gönüllülük ve Sosyal Sorumluluk",
        "description": "Farklı üniversitelerden öğrencilerin sosyal sorumluluk, gönüllülük ve toplumsal fayda projelerinde buluştuğu topluluk.",
        "category": "Sosyal",
        "university": None,
        "city": None,
        "scope": "country",
        "tags": ["gönüllülük", "sosyal sorumluluk", "mentorluk", "takım çalışması", "topluluk kurma"],
        "max_members": 1000,
    },
    {
        "name": "Online Oyun Geliştirme ve E-Spor",
        "description": "Şehirden bağımsız olarak oyun geliştirme, e-spor, video oyunları ve oyun tasarımıyla ilgilenen öğrenciler için online topluluk.",
        "category": "Oyun ve Eğlence",
        "university": None,
        "city": None,
        "scope": "online",
        "tags": ["oyun geliştirme", "video oyunları", "e-spor", "unity", "game design", "kutu oyunları"],
        "max_members": 800,
    },
    {
        "name": "Online Psikoloji ve Kişisel Gelişim",
        "description": "Psikoloji, mental sağlık, mindfulness, motivasyon ve kişisel gelişim konularına ilgi duyan öğrenciler için online topluluk.",
        "category": "Sağlık ve Yaşam",
        "university": None,
        "city": None,
        "scope": "online",
        "tags": ["psikoloji", "mental sağlık", "kişisel gelişim", "mindfulness", "meditasyon"],
        "max_members": 800,
    },
    {
        "name": "Online Dil Öğrenme ve Kültür",
        "description": "Yabancı dil öğrenmek, konuşma pratiği yapmak ve farklı kültürleri tanımak isteyen öğrenciler için online topluluk.",
        "category": "Eğitim",
        "university": None,
        "city": None,
        "scope": "online",
        "tags": ["dil öğrenme", "kültür", "konuşma pratiği", "sertifika programları", "sunum yapma"],
        "max_members": 700,
    },
]


DEMO_USERS = [
    {
        "name": "Deniz Yılmaz",
        "email": "deniz.yilmaz@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "Zonguldak Bülent Ecevit Üniversitesi",
        "department": "Bilgisayar Mühendisliği",
        "year": "3. Sınıf",
        "city": "Zonguldak",
        "bio": "Yapay zeka, veri bilimi ve Python projeleriyle ilgileniyorum.",
        "personality_type": "INTP",
        "hobbies": ["Yapay Zeka", "Veri Bilimi", "Matematik", "Akademik Araştırma", "Makine Öğrenmesi"],
        "visibility_scope": "city",
    },
    {
        "name": "Ece Demir",
        "email": "ece.demir@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "İstanbul Teknik Üniversitesi",
        "department": "İşletme",
        "year": "4. Sınıf",
        "city": "İstanbul",
        "bio": "Startup, girişimcilik ve etkinlik organizasyonu üzerine çalışıyorum.",
        "personality_type": "ENTJ",
        "hobbies": ["Girişimcilik", "Startup", "Liderlik", "Networking", "Proje Yönetimi"],
        "visibility_scope": "city",
    },
    {
        "name": "Mert Kaya",
        "email": "mert.kaya@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "Yıldız Teknik Üniversitesi",
        "department": "Elektrik Elektronik Mühendisliği",
        "year": "2. Sınıf",
        "city": "İstanbul",
        "bio": "Siber güvenlik, Linux ve CTF konularını öğreniyorum.",
        "personality_type": "ISTP",
        "hobbies": ["Siber Güvenlik", "Linux", "Robotik", "DevOps", "Cloud Computing"],
        "visibility_scope": "country",
    },
    {
        "name": "Zeynep Aydın",
        "email": "zeynep.aydin@demo.edu.tr",
        "password_hash": "demo-user-no-login",
        "university": "Orta Doğu Teknik Üniversitesi",
        "department": "Psikoloji",
        "year": "3. Sınıf",
        "city": "Ankara",
        "bio": "Psikoloji, gönüllülük ve sosyal sorumluluk projelerine ilgi duyuyorum.",
        "personality_type": "INFJ",
        "hobbies": ["Psikoloji", "Gönüllülük", "Sosyal Sorumluluk", "Mental Sağlık", "Mentorluk"],
        "visibility_scope": "country",
    },
]


def seed_communities() -> None:
    for item in COMMUNITIES:
        existing = Community.query.filter_by(name=item["name"]).first()

        if existing:
            existing.description = item["description"]
            existing.category = item["category"]
            existing.university = item.get("university")
            existing.city = item.get("city")
            existing.scope = item.get("scope", "country")
            existing.tags = item["tags"]
            existing.max_members = item["max_members"]
            existing.is_active = True
            community = existing
        else:
            community = Community(
                name=item["name"],
                description=item["description"],
                category=item["category"],
                university=item.get("university"),
                city=item.get("city"),
                scope=item.get("scope", "country"),
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
            existing.city = item.get("city")
            existing.bio = item["bio"]
            existing.personality_type = item["personality_type"]
            existing.hobbies = item["hobbies"]
            existing.visibility_scope = item.get("visibility_scope", "city")
            existing.profile_visibility = True
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
                city=item.get("city"),
                bio=item["bio"],
                personality_type=item["personality_type"],
                hobbies=item["hobbies"],
                visibility_scope=item.get("visibility_scope", "city"),
                profile_visibility=True,
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