"""
Brand and sponsorship models for FriendZone.

This module contains:
- Brand
- EventSponsor
- CommunitySponsor
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class Brand(db.Model):
    """
    Brand table.

    Brands can sponsor events, communities, campaigns,
    discounts, bootcamps, workshops or student experiences.
    """

    __tablename__ = "brands"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(160), nullable=False, unique=True, index=True)
    slug = db.Column(db.String(180), nullable=False, unique=True, index=True)

    description = db.Column(db.Text, nullable=True)
    website_url = db.Column(db.String(255), nullable=True)
    logo_image = db.Column(db.String(255), nullable=True)

    category = db.Column(db.String(100), nullable=True)
    target_audience = db.Column(db.String(180), nullable=True)

    contact_email = db.Column(db.String(180), nullable=True)
    campaign_url = db.Column(db.String(255), nullable=True)
    discount_code = db.Column(db.String(80), nullable=True)

    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    event_sponsorships = db.relationship(
        "EventSponsor",
        back_populates="brand",
        cascade="all, delete-orphan",
        lazy=True,
    )

    community_sponsorships = db.relationship(
        "CommunitySponsor",
        back_populates="brand",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(self) -> dict:
        """
        Serialize brand.
        """

        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "website_url": self.website_url,
            "logo_image": self.logo_image,
            "logo_image_url": f"/uploads/brand_logos/{self.logo_image}" if self.logo_image else None,
            "category": self.category,
            "target_audience": self.target_audience,
            "contact_email": self.contact_email,
            "campaign_url": self.campaign_url,
            "discount_code": self.discount_code,
            "is_verified": self.is_verified,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Brand {self.name}>"


class EventSponsor(db.Model):
    """
    Event sponsorship table.

    Connects a brand with an event.
    """

    __tablename__ = "event_sponsors"

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id"),
        nullable=False,
        index=True,
    )

    brand_id = db.Column(
        db.Integer,
        db.ForeignKey("brands.id"),
        nullable=False,
        index=True,
    )

    sponsorship_type = db.Column(db.String(80), nullable=False, default="sponsor")
    title = db.Column(db.String(160), nullable=True)
    description = db.Column(db.Text, nullable=True)

    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_featured = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    brand = db.relationship(
        "Brand",
        back_populates="event_sponsorships",
    )

    __table_args__ = (
        db.UniqueConstraint("event_id", "brand_id", name="uq_event_sponsor_brand"),
    )

    def to_dict(self) -> dict:
        """
        Serialize event sponsorship.
        """

        return {
            "id": self.id,
            "event_id": self.event_id,
            "brand_id": self.brand_id,
            "sponsorship_type": self.sponsorship_type,
            "title": self.title,
            "description": self.description,
            "display_order": self.display_order,
            "is_featured": self.is_featured,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "brand": self.brand.to_dict() if self.brand else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<EventSponsor event={self.event_id} brand={self.brand_id}>"


class CommunitySponsor(db.Model):
    """
    Community sponsorship table.

    Connects a brand with a community.
    """

    __tablename__ = "community_sponsors"

    id = db.Column(db.Integer, primary_key=True)

    community_id = db.Column(
        db.Integer,
        db.ForeignKey("communities.id"),
        nullable=False,
        index=True,
    )

    brand_id = db.Column(
        db.Integer,
        db.ForeignKey("brands.id"),
        nullable=False,
        index=True,
    )

    sponsorship_type = db.Column(db.String(80), nullable=False, default="sponsor")
    title = db.Column(db.String(160), nullable=True)
    description = db.Column(db.Text, nullable=True)

    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_featured = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    brand = db.relationship(
        "Brand",
        back_populates="community_sponsorships",
    )

    __table_args__ = (
        db.UniqueConstraint("community_id", "brand_id", name="uq_community_sponsor_brand"),
    )

    def to_dict(self) -> dict:
        """
        Serialize community sponsorship.
        """

        return {
            "id": self.id,
            "community_id": self.community_id,
            "brand_id": self.brand_id,
            "sponsorship_type": self.sponsorship_type,
            "title": self.title,
            "description": self.description,
            "display_order": self.display_order,
            "is_featured": self.is_featured,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "brand": self.brand.to_dict() if self.brand else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<CommunitySponsor community={self.community_id} brand={self.brand_id}>"