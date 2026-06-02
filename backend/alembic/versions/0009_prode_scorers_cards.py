"""Prode al goleador + per-match scorer/card predictions.

Adds:
  - matches.scorers / matches.booked  (actual player-level events)
  - predictions.pred_scorers / predictions.pred_cards  (optional picks)
  - scores.pts_scorers / scores.pts_cards
  - top_scorer_predictions table (one tournament top-scorer pick per prode)
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("scorers", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("matches", sa.Column("booked", postgresql.ARRAY(sa.String()), nullable=True))

    op.add_column("predictions", sa.Column("pred_scorers", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("predictions", sa.Column("pred_cards", postgresql.ARRAY(sa.String()), nullable=True))

    op.add_column("scores", sa.Column("pts_scorers", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("scores", sa.Column("pts_cards", sa.Integer(), nullable=False, server_default="0"))

    op.create_table(
        "top_scorer_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("column_id", sa.Integer(), sa.ForeignKey("columns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_name", sa.String(length=120), nullable=False),
        sa.Column("team_name", sa.String(length=120), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "column_id", name="uq_topscorer_user_column"),
    )
    op.create_index("ix_top_scorer_predictions_user_id", "top_scorer_predictions", ["user_id"])
    op.create_index("ix_top_scorer_predictions_column_id", "top_scorer_predictions", ["column_id"])


def downgrade() -> None:
    op.drop_index("ix_top_scorer_predictions_column_id", table_name="top_scorer_predictions")
    op.drop_index("ix_top_scorer_predictions_user_id", table_name="top_scorer_predictions")
    op.drop_table("top_scorer_predictions")
    op.drop_column("scores", "pts_cards")
    op.drop_column("scores", "pts_scorers")
    op.drop_column("predictions", "pred_cards")
    op.drop_column("predictions", "pred_scorers")
    op.drop_column("matches", "booked")
    op.drop_column("matches", "scorers")
