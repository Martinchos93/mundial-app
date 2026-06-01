"""user accounts (login) + many-to-many memberships

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Auth model changed fundamentally; start users fresh (cascades to predictions/scores).
    op.execute("DELETE FROM users")

    op.drop_index("ix_users_status", table_name="users")
    op.drop_column("users", "status")
    op.drop_column("users", "group_id")
    op.drop_column("users", "name")

    op.add_column("users", sa.Column("username", sa.String(length=40), nullable=False))
    op.add_column("users", sa.Column("email", sa.String(length=160), nullable=False))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=False))
    op.add_column("users", sa.Column("first_name", sa.String(length=80), nullable=False))
    op.add_column("users", sa.Column("last_name", sa.String(length=80), nullable=False))
    op.add_column("users", sa.Column("age", sa.Integer(), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_is_admin", "users", ["is_admin"])

    op.create_table(
        "memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "group_id", name="uq_membership_user_group"),
    )
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_index("ix_memberships_group_id", "memberships", ["group_id"])
    op.create_index("ix_memberships_status", "memberships", ["status"])


def downgrade() -> None:
    op.drop_table("memberships")
    op.drop_index("ix_users_is_admin", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "age")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email")
    op.drop_column("users", "username")
    op.add_column("users", sa.Column("name", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("group_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("status", sa.String(length=20), nullable=True))
