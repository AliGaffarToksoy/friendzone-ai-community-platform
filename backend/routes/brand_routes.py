"""
Brand and sponsorship routes for FriendZone.
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from backend.database.db_connection import db
from backend.models.brand_model import Brand, CommunitySponsor, EventSponsor
from backend.models.community_model import Community, CommunityMember
from backend.models.event_model import Event
from backend.services.gamification_service import add_points
from backend.services.notification_service import notify_community_members
from backend.utils.helpers import error_response, success_response


brand_bp = Blueprint("brands", __name__)


ALLOWED_LOGO_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "svg"}
MAX_LOGO_SIZE_MB = 4

VALID_SPONSORSHIP_TYPES = {
    "sponsor",
    "main_sponsor",
    "gold_sponsor",
    "silver_sponsor",
    "bronze_sponsor",
    "media_sponsor",
    "education_partner",
    "technology_partner",
    "community_partner",
}


def get_brand_upload_root() -> Path:
    """
    Return brand logo upload directory.
    """

    root = Path(current_app.root_path) / "uploads" / "brand_logos"
    root.mkdir(parents=True, exist_ok=True)
    return root


def slugify(value: str) -> str:
    """
    Generate URL-safe slug from brand name.
    """

    value = value.strip().lower()

    replacements = {
        "ğ": "g",
        "ü": "u",
        "ş": "s",
        "ı": "i",
        "ö": "o",
        "ç": "c",
    }

    for source, target in replacements.items():
        value = value.replace(source, target)

    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")

    return value or f"brand-{uuid.uuid4().hex[:8]}"


def make_unique_slug(name: str, existing_brand_id: int | None = None) -> str:
    """
    Create unique brand slug.
    """

    base_slug = slugify(name)
    slug = base_slug
    counter = 2

    while True:
        query = Brand.query.filter_by(slug=slug)

        if existing_brand_id:
            query = query.filter(Brand.id != existing_brand_id)

        existing = query.first()

        if not existing:
            return slug

        slug = f"{base_slug}-{counter}"
        counter += 1


def is_allowed_logo(filename: str) -> bool:
    """
    Validate logo image extension.
    """

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_LOGO_EXTENSIONS


def save_logo_from_request() -> str | None:
    """
    Save uploaded brand logo if present.
    """

    if "logo" not in request.files:
        return None

    file = request.files["logo"]

    if not file or file.filename == "":
        return None

    if not is_allowed_logo(file.filename):
        raise ValueError("Sadece png, jpg, jpeg, webp veya svg logo dosyaları kabul edilir.")

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    max_size_bytes = MAX_LOGO_SIZE_MB * 1024 * 1024

    if file_size > max_size_bytes:
        raise ValueError(f"Logo dosyası en fazla {MAX_LOGO_SIZE_MB}MB olabilir.")

    upload_root = get_brand_upload_root()

    original_name = secure_filename(file.filename)
    extension = original_name.rsplit(".", 1)[1].lower()
    filename = f"brand_{uuid.uuid4().hex}.{extension}"

    file.save(upload_root / filename)

    return filename


def delete_logo_file(filename: str | None) -> None:
    """
    Delete brand logo file from disk if exists.
    """

    if not filename:
        return

    try:
        logo_path = get_brand_upload_root() / filename

        if logo_path.exists() and logo_path.is_file():
            logo_path.unlink()
    except Exception as exc:
        current_app.logger.warning(f"Brand logo could not be deleted: {exc}")


def get_request_value(name: str, default: str = "") -> str:
    """
    Get field from form-data or json body.
    """

    if request.form:
        return str(request.form.get(name, default)).strip()

    data = request.get_json(silent=True) or {}
    return str(data.get(name, default)).strip()


def get_request_bool(name: str, default: bool = False) -> bool:
    """
    Parse boolean field from form-data or json body.
    """

    value = get_request_value(name, str(default)).lower()

    return value in {"true", "1", "yes", "on"}


def get_request_int(name: str, default: int = 0) -> int:
    """
    Parse integer field from form-data or json body.
    """

    try:
        return int(get_request_value(name, str(default)))
    except Exception:
        return default


def user_membership(user_id: int, community_id: int) -> CommunityMember | None:
    """
    Return active community membership.
    """

    return CommunityMember.query.filter_by(
        user_id=user_id,
        community_id=community_id,
        is_active=True,
    ).first()


def user_is_community_member(user_id: int, community_id: int) -> bool:
    """
    Check active membership.
    """

    return user_membership(user_id, community_id) is not None


def user_can_manage_community_sponsors(user_id: int, community_id: int) -> bool:
    """
    Only community admins can manage community-level sponsors.
    """

    membership = user_membership(user_id, community_id)

    if not membership:
        return False

    return membership.role == "admin"


def user_can_manage_event_sponsors(user_id: int, event: Event) -> bool:
    """
    Admins can manage all event sponsors.
    Moderators can manage sponsors only for their own events.
    """

    membership = user_membership(user_id, event.community_id)

    if not membership:
        return False

    if membership.role == "admin":
        return True

    if membership.role == "moderator" and event.created_by == user_id:
        return True

    return False


def serialize_brand_list(brands: list[Brand]) -> list[dict]:
    """
    Serialize brand list.
    """

    return [brand.to_dict() for brand in brands]


def serialize_sponsor_list(sponsors: list[EventSponsor | CommunitySponsor]) -> list[dict]:
    """
    Serialize sponsorship list.
    """

    return [sponsor.to_dict() for sponsor in sponsors]


@brand_bp.route("", methods=["GET"])
@jwt_required()
def list_brands() -> tuple:
    """
    List active brands.

    Optional query params:
    - q
    - category
    - verified=true
    """

    query = Brand.query.filter_by(is_active=True)

    search = request.args.get("q")
    category = request.args.get("category")
    verified = request.args.get("verified")

    if search:
        search_text = f"%{search.strip()}%"
        query = query.filter(Brand.name.ilike(search_text))

    if category:
        query = query.filter(Brand.category == category)

    if verified is not None:
        is_verified = str(verified).lower() in {"true", "1", "yes"}
        query = query.filter(Brand.is_verified == is_verified)

    brands = query.order_by(Brand.name.asc()).all()

    return success_response("Markalar getirildi.", serialize_brand_list(brands))


@brand_bp.route("/create", methods=["POST"])
@jwt_required()
def create_brand() -> tuple:
    """
    Create brand.

    Accepts multipart/form-data or JSON:
    - name
    - description
    - website_url
    - category
    - target_audience
    - contact_email
    - campaign_url
    - discount_code
    - logo
    """

    user_id = int(get_jwt_identity())

    name = get_request_value("name")
    description = get_request_value("description")
    website_url = get_request_value("website_url")
    category = get_request_value("category")
    target_audience = get_request_value("target_audience")
    contact_email = get_request_value("contact_email")
    campaign_url = get_request_value("campaign_url")
    discount_code = get_request_value("discount_code")

    if not name or len(name) < 2:
        return error_response("Marka adı en az 2 karakter olmalıdır.")

    existing = Brand.query.filter(db.func.lower(Brand.name) == name.lower()).first()

    if existing:
        return error_response("Bu isimde bir marka zaten var.", status_code=409)

    logo_filename = None

    try:
        logo_filename = save_logo_from_request()
    except ValueError as exc:
        return error_response(str(exc))

    brand = Brand(
        name=name,
        slug=make_unique_slug(name),
        description=description or None,
        website_url=website_url or None,
        logo_image=logo_filename,
        category=category or None,
        target_audience=target_audience or None,
        contact_email=contact_email or None,
        campaign_url=campaign_url or None,
        discount_code=discount_code or None,
        is_verified=False,
        is_active=True,
        created_by=user_id,
    )

    db.session.add(brand)
    db.session.commit()

    return success_response("Marka oluşturuldu.", brand.to_dict(), status_code=201)


@brand_bp.route("/<int:brand_id>", methods=["GET"])
@jwt_required()
def get_brand(brand_id: int) -> tuple:
    """
    Return brand detail.
    """

    brand = Brand.query.get(brand_id)

    if not brand or not brand.is_active:
        return error_response("Marka bulunamadı.", status_code=404)

    return success_response("Marka detayı getirildi.", brand.to_dict())


@brand_bp.route("/<int:brand_id>", methods=["PATCH"])
@jwt_required()
def update_brand(brand_id: int) -> tuple:
    """
    Update brand.

    For now, brand creator can update the brand.
    Later this can be moved to admin/brand representative logic.
    """

    user_id = int(get_jwt_identity())

    brand = Brand.query.get(brand_id)

    if not brand or not brand.is_active:
        return error_response("Marka bulunamadı.", status_code=404)

    if brand.created_by and brand.created_by != user_id:
        return error_response("Bu markayı düzenleme yetkiniz yok.", status_code=403)

    name = get_request_value("name", brand.name)
    description = get_request_value("description", brand.description or "")
    website_url = get_request_value("website_url", brand.website_url or "")
    category = get_request_value("category", brand.category or "")
    target_audience = get_request_value("target_audience", brand.target_audience or "")
    contact_email = get_request_value("contact_email", brand.contact_email or "")
    campaign_url = get_request_value("campaign_url", brand.campaign_url or "")
    discount_code = get_request_value("discount_code", brand.discount_code or "")

    if not name or len(name) < 2:
        return error_response("Marka adı en az 2 karakter olmalıdır.")

    existing = (
        Brand.query
        .filter(db.func.lower(Brand.name) == name.lower(), Brand.id != brand.id)
        .first()
    )

    if existing:
        return error_response("Bu isimde başka bir marka zaten var.", status_code=409)

    try:
        new_logo = save_logo_from_request()
    except ValueError as exc:
        return error_response(str(exc))

    if new_logo:
        old_logo = brand.logo_image
        brand.logo_image = new_logo
        delete_logo_file(old_logo)

    brand.name = name
    brand.slug = make_unique_slug(name, existing_brand_id=brand.id)
    brand.description = description or None
    brand.website_url = website_url or None
    brand.category = category or None
    brand.target_audience = target_audience or None
    brand.contact_email = contact_email or None
    brand.campaign_url = campaign_url or None
    brand.discount_code = discount_code or None

    db.session.commit()

    return success_response("Marka güncellendi.", brand.to_dict())


@brand_bp.route("/<int:brand_id>", methods=["DELETE"])
@jwt_required()
def delete_brand(brand_id: int) -> tuple:
    """
    Soft-delete brand.

    For now, brand creator can delete the brand.
    """

    user_id = int(get_jwt_identity())

    brand = Brand.query.get(brand_id)

    if not brand or not brand.is_active:
        return error_response("Marka bulunamadı.", status_code=404)

    if brand.created_by and brand.created_by != user_id:
        return error_response("Bu markayı silme yetkiniz yok.", status_code=403)

    brand.is_active = False
    db.session.commit()

    return success_response("Marka silindi.", {
        "brand_id": brand.id,
        "is_active": brand.is_active,
    })


@brand_bp.route("/events/<int:event_id>/sponsors", methods=["GET"])
@jwt_required()
def list_event_sponsors(event_id: int) -> tuple:
    """
    List sponsors for an event.
    """

    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, event.community_id):
        return error_response("Sponsorları görmek için topluluğa üye olmalısınız.", status_code=403)

    sponsors = (
        EventSponsor.query
        .filter_by(event_id=event.id, is_active=True)
        .order_by(
            EventSponsor.is_featured.desc(),
            EventSponsor.display_order.asc(),
            EventSponsor.created_at.asc(),
        )
        .all()
    )

    return success_response("Etkinlik sponsorları getirildi.", serialize_sponsor_list(sponsors))


@brand_bp.route("/events/<int:event_id>/sponsors", methods=["POST"])
@jwt_required()
def add_event_sponsor(event_id: int) -> tuple:
    """
    Add sponsor brand to event.

    A new event sponsor relationship gives social points and notifies
    related community members.
    Updating an existing relationship does not give duplicate points.
    """

    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_can_manage_event_sponsors(user_id, event):
        return error_response("Bu etkinliğe sponsor ekleme yetkiniz yok.", status_code=403)

    data = request.get_json(silent=True) or {}

    brand_id = data.get("brand_id")
    sponsorship_type = str(data.get("sponsorship_type", "sponsor")).strip()
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    display_order = data.get("display_order", 0)
    is_featured = bool(data.get("is_featured", False))

    if not brand_id:
        return error_response("Marka ID zorunludur.")

    if sponsorship_type not in VALID_SPONSORSHIP_TYPES:
        return error_response("Geçersiz sponsorluk tipi.")

    brand = Brand.query.get(int(brand_id))

    if not brand or not brand.is_active:
        return error_response("Marka bulunamadı.", status_code=404)

    existing = EventSponsor.query.filter_by(
        event_id=event.id,
        brand_id=brand.id,
    ).first()

    is_new_sponsor = False

    if existing:
        existing.sponsorship_type = sponsorship_type
        existing.title = title or None
        existing.description = description or None
        existing.display_order = int(display_order or 0)
        existing.is_featured = is_featured

        if not existing.is_active:
            is_new_sponsor = True

        existing.is_active = True
        sponsor = existing
    else:
        sponsor = EventSponsor(
            event_id=event.id,
            brand_id=brand.id,
            sponsorship_type=sponsorship_type,
            title=title or None,
            description=description or None,
            display_order=int(display_order or 0),
            is_featured=is_featured,
            is_active=True,
            created_by=user_id,
        )

        db.session.add(sponsor)
        db.session.flush()
        is_new_sponsor = True

    db.session.commit()

    if is_new_sponsor:
        add_points(
            user_id=user_id,
            action_type="sponsor_added",
            description=f"{event.title} etkinliğine sponsor ekledi.",
            reference_type="event_sponsor",
            reference_id=sponsor.id,
            allow_duplicate=False,
        )

        notify_community_members(
            community_id=event.community_id,
            notification_type="event_sponsor_added",
            title="Etkinliğe yeni sponsor eklendi",
            message=f"{event.title} etkinliğine {brand.name} sponsoru eklendi.",
            reference_type="event_sponsor",
            reference_id=sponsor.id,
            action_url=f"community.html?id={event.community_id}",
            icon="🤝",
            exclude_user_ids=[user_id],
            unique=False,
            commit=True,
        )

    return success_response("Etkinlik sponsoru kaydedildi.", sponsor.to_dict(), status_code=201)


@brand_bp.route("/events/<int:event_id>/sponsors/<int:sponsor_id>", methods=["DELETE"])
@jwt_required()
def remove_event_sponsor(event_id: int, sponsor_id: int) -> tuple:
    """
    Remove event sponsor.
    """

    user_id = int(get_jwt_identity())

    event = Event.query.get(event_id)

    if not event or not event.is_active:
        return error_response("Etkinlik bulunamadı.", status_code=404)

    if not user_can_manage_event_sponsors(user_id, event):
        return error_response("Bu etkinlik sponsorunu kaldırma yetkiniz yok.", status_code=403)

    sponsor = EventSponsor.query.filter_by(
        id=sponsor_id,
        event_id=event.id,
    ).first()

    if not sponsor or not sponsor.is_active:
        return error_response("Sponsor kaydı bulunamadı.", status_code=404)

    sponsor.is_active = False
    db.session.commit()

    return success_response("Etkinlik sponsoru kaldırıldı.", {
        "sponsor_id": sponsor.id,
        "is_active": sponsor.is_active,
    })


@brand_bp.route("/communities/<int:community_id>/sponsors", methods=["GET"])
@jwt_required()
def list_community_sponsors(community_id: int) -> tuple:
    """
    List sponsors for community.
    """

    user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_is_community_member(user_id, community.id):
        return error_response("Sponsorları görmek için topluluğa üye olmalısınız.", status_code=403)

    sponsors = (
        CommunitySponsor.query
        .filter_by(community_id=community.id, is_active=True)
        .order_by(
            CommunitySponsor.is_featured.desc(),
            CommunitySponsor.display_order.asc(),
            CommunitySponsor.created_at.asc(),
        )
        .all()
    )

    return success_response("Topluluk sponsorları getirildi.", serialize_sponsor_list(sponsors))


@brand_bp.route("/communities/<int:community_id>/sponsors", methods=["POST"])
@jwt_required()
def add_community_sponsor(community_id: int) -> tuple:
    """
    Add sponsor brand to community.

    A new community sponsor relationship gives social points and notifies
    related community members.
    Updating an existing relationship does not give duplicate points.
    """

    user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_can_manage_community_sponsors(user_id, community.id):
        return error_response("Bu topluluğa sponsor ekleme yetkiniz yok.", status_code=403)

    data = request.get_json(silent=True) or {}

    brand_id = data.get("brand_id")
    sponsorship_type = str(data.get("sponsorship_type", "sponsor")).strip()
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    display_order = data.get("display_order", 0)
    is_featured = bool(data.get("is_featured", False))

    if not brand_id:
        return error_response("Marka ID zorunludur.")

    if sponsorship_type not in VALID_SPONSORSHIP_TYPES:
        return error_response("Geçersiz sponsorluk tipi.")

    brand = Brand.query.get(int(brand_id))

    if not brand or not brand.is_active:
        return error_response("Marka bulunamadı.", status_code=404)

    existing = CommunitySponsor.query.filter_by(
        community_id=community.id,
        brand_id=brand.id,
    ).first()

    is_new_sponsor = False

    if existing:
        existing.sponsorship_type = sponsorship_type
        existing.title = title or None
        existing.description = description or None
        existing.display_order = int(display_order or 0)
        existing.is_featured = is_featured

        if not existing.is_active:
            is_new_sponsor = True

        existing.is_active = True
        sponsor = existing
    else:
        sponsor = CommunitySponsor(
            community_id=community.id,
            brand_id=brand.id,
            sponsorship_type=sponsorship_type,
            title=title or None,
            description=description or None,
            display_order=int(display_order or 0),
            is_featured=is_featured,
            is_active=True,
            created_by=user_id,
        )

        db.session.add(sponsor)
        db.session.flush()
        is_new_sponsor = True

    db.session.commit()

    if is_new_sponsor:
        add_points(
            user_id=user_id,
            action_type="sponsor_added",
            description=f"{community.name} topluluğuna sponsor ekledi.",
            reference_type="community_sponsor",
            reference_id=sponsor.id,
            allow_duplicate=False,
        )

        notify_community_members(
            community_id=community.id,
            notification_type="community_sponsor_added",
            title="Topluluğa yeni sponsor eklendi",
            message=f"{community.name} topluluğuna {brand.name} sponsoru eklendi.",
            reference_type="community_sponsor",
            reference_id=sponsor.id,
            action_url=f"community.html?id={community.id}",
            icon="🤝",
            exclude_user_ids=[user_id],
            unique=False,
            commit=True,
        )

    return success_response("Topluluk sponsoru kaydedildi.", sponsor.to_dict(), status_code=201)


@brand_bp.route("/communities/<int:community_id>/sponsors/<int:sponsor_id>", methods=["DELETE"])
@jwt_required()
def remove_community_sponsor(community_id: int, sponsor_id: int) -> tuple:
    """
    Remove community sponsor.
    """

    user_id = int(get_jwt_identity())

    community = Community.query.get(community_id)

    if not community or not community.is_active:
        return error_response("Topluluk bulunamadı.", status_code=404)

    if not user_can_manage_community_sponsors(user_id, community.id):
        return error_response("Bu topluluk sponsorunu kaldırma yetkiniz yok.", status_code=403)

    sponsor = CommunitySponsor.query.filter_by(
        id=sponsor_id,
        community_id=community.id,
    ).first()
    if not sponsor or not sponsor.is_active:
        return error_response("Sponsor kaydı bulunamadı.", status_code=404)

    sponsor.is_active = False
    db.session.commit()

    return success_response("Topluluk sponsoru kaldırıldı.", {
        "sponsor_id": sponsor.id,
        "is_active": sponsor.is_active,
    })