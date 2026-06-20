"""Score history: audit trail of score changes (before/after)."""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "score_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "prediction_id",
            sa.Integer(),
            sa.ForeignKey("predictions.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
        sa.Column("source", sa.String(length=40), index=True, nullable=False),
        sa.Column("old_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("new_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("old_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("score_history")
