"""Polls / surveys: option-based and free-text."""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "polls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question", sa.String(length=200), nullable=False),
        sa.Column("kind", sa.String(length=16), server_default="options", nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), index=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "poll_responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("poll_id", sa.Integer(), sa.ForeignKey("polls.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("option_index", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("poll_id", "user_id", name="uq_poll_user"),
    )


def downgrade() -> None:
    op.drop_table("poll_responses")
    op.drop_table("polls")
