"""
Moderation models for FriendZone.

This module contains:
- ModerationReport
- ModerationAction
- UserWarning

These tables power the Admin Moderation & Reporting Center.
"""

from __future__ import annotations

from datetime import datetime

from backend.database.db_connection import db


class ModerationReport(db.Model):
    """
    User-submitted report / complaint table.

    Supported target_type examples:
    - user
    - feed_post
    - feed_comment
    - community
    - event
    - social_room
    - chat_message

    status values:
    - pending
    - reviewing
    - resolved
    - rejected

    severity values:
    - low
    - medium
    - high
    - critical
    """

    __tablename__ = "moderation_reports"

    id = db.Column(db.Integer, primary_key=True)

    reporter_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    target_type = db.Column(db.String(50), nullable=False, index=True)
    target_id = db.Column(db.Integer, nullable=False, index=True)

    reported_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    reason = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)

    status = db.Column(db.String(30), nullable=False, default="pending", index=True)
    severity = db.Column(db.String(30), nullable=False, default="medium", index=True)

    admin_note = db.Column(db.Text, nullable=True)

    reviewed_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    reviewed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(
        self,
        reporter: object | None = None,
        reported_user: object | None = None,
        reviewer: object | None = None,
        target_summary: dict | None = None,
    ) -> dict:
        """
        Serialize moderation report.
        """

        return {
            "id": self.id,
            "reporter_user_id": self.reporter_user_id,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "reported_user_id": self.reported_user_id,
            "reason": self.reason,
            "description": self.description,
            "status": self.status,
            "severity": self.severity,
            "admin_note": self.admin_note,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "reporter": {
                "id": reporter.id,
                "name": reporter.name,
                "email": reporter.email,
                "university": getattr(reporter, "university", None),
            } if reporter else None,
            "reported_user": {
                "id": reported_user.id,
                "name": reported_user.name,
                "email": reported_user.email,
                "university": getattr(reported_user, "university", None),
                "is_active": getattr(reported_user, "is_active", None),
            } if reported_user else None,
            "reviewer": {
                "id": reviewer.id,
                "name": reviewer.name,
                "email": reviewer.email,
            } if reviewer else None,
            "target_summary": target_summary,
        }

    def __repr__(self) -> str:
        return f"<ModerationReport {self.id} {self.target_type}:{self.target_id}>"


class ModerationAction(db.Model):
    """
    Admin action log table.

    action_type examples:
    - warn_user
    - deactivate_user
    - reactivate_user
    - hide_feed_post
    - restore_feed_post
    - hide_feed_comment
    - restore_feed_comment
    - deactivate_community
    - reactivate_community
    - deactivate_event
    - reactivate_event
    - close_social_room
    - resolve_report
    - reject_report
    """

    __tablename__ = "moderation_actions"

    id = db.Column(db.Integer, primary_key=True)

    admin_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    report_id = db.Column(
        db.Integer,
        db.ForeignKey("moderation_reports.id"),
        nullable=True,
        index=True,
    )

    action_type = db.Column(db.String(80), nullable=False, index=True)

    target_type = db.Column(db.String(50), nullable=False, index=True)
    target_id = db.Column(db.Integer, nullable=False, index=True)

    target_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    reason = db.Column(db.String(180), nullable=True)
    note = db.Column(db.Text, nullable=True)

    metadata_json = db.Column(db.JSON, nullable=True, default=dict)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(
        self,
        admin_user: object | None = None,
        target_user: object | None = None,
        report: ModerationReport | None = None,
    ) -> dict:
        """
        Serialize moderation action.
        """

        return {
            "id": self.id,
            "admin_user_id": self.admin_user_id,
            "report_id": self.report_id,
            "action_type": self.action_type,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "target_user_id": self.target_user_id,
            "reason": self.reason,
            "note": self.note,
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "admin_user": {
                "id": admin_user.id,
                "name": admin_user.name,
                "email": admin_user.email,
            } if admin_user else None,
            "target_user": {
                "id": target_user.id,
                "name": target_user.name,
                "email": target_user.email,
                "is_active": getattr(target_user, "is_active", None),
            } if target_user else None,
            "report": {
                "id": report.id,
                "status": report.status,
                "severity": report.severity,
                "reason": report.reason,
            } if report else None,
        }

    def __repr__(self) -> str:
        return f"<ModerationAction {self.action_type} {self.target_type}:{self.target_id}>"


class UserWarning(db.Model):
    """
    User warning table.

    Admin can warn users without immediately deactivating the account.
    """

    __tablename__ = "user_warnings"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    admin_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    report_id = db.Column(
        db.Integer,
        db.ForeignKey("moderation_reports.id"),
        nullable=True,
        index=True,
    )

    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(30), nullable=False, default="medium")

    is_acknowledged = db.Column(db.Boolean, nullable=False, default=False)
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(
        self,
        user: object | None = None,
        admin_user: object | None = None,
    ) -> dict:
        """
        Serialize warning.
        """

        return {
            "id": self.id,
            "user_id": self.user_id,
            "admin_user_id": self.admin_user_id,
            "report_id": self.report_id,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "is_acknowledged": self.is_acknowledged,
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
            } if user else None,
            "admin_user": {
                "id": admin_user.id,
                "name": admin_user.name,
                "email": admin_user.email,
            } if admin_user else None,
        }

    def __repr__(self) -> str:
        return f"<UserWarning user={self.user_id} severity={self.severity}>"