"""add user profile fields

Revision ID: ab6e6ccee4c3
Revises: 1e1a761c7602
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa


revision = "ab6e6ccee4c3"
down_revision = "1e1a761c7602"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("city", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("profile_image", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column(
                "visibility_scope",
                sa.String(length=30),
                nullable=False,
                server_default="university",
            )
        )
        batch_op.add_column(
            sa.Column(
                "profile_visibility",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            )
        )

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("visibility_scope", server_default=None)
        batch_op.alter_column("profile_visibility", server_default=None)


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("profile_visibility")
        batch_op.drop_column("visibility_scope")
        batch_op.drop_column("profile_image")
        batch_op.drop_column("city")