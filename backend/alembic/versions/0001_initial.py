"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("invite_code", sa.String(length=6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_groups_invite_code", "groups", ["invite_code"], unique=True)

    op.create_table(
        "matches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("api_id", sa.Integer(), nullable=True),
        sa.Column("home_team", sa.String(length=120), nullable=False),
        sa.Column("away_team", sa.String(length=120), nullable=False),
        sa.Column("home_team_id", sa.Integer(), nullable=True),
        sa.Column("away_team_id", sa.Integer(), nullable=True),
        sa.Column("kickoff_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("phase", sa.String(length=60), nullable=True),
        sa.Column("venue", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("home_score", sa.Integer(), nullable=True),
        sa.Column("away_score", sa.Integer(), nullable=True),
        sa.Column("minute", sa.Integer(), nullable=True),
        sa.Column("home_yellows", sa.Integer(), nullable=True),
        sa.Column("away_yellows", sa.Integer(), nullable=True),
        sa.Column("home_reds", sa.Integer(), nullable=True),
        sa.Column("away_reds", sa.Integer(), nullable=True),
        sa.Column("home_xg", sa.Float(), nullable=True),
        sa.Column("away_xg", sa.Float(), nullable=True),
        sa.Column("home_possession", sa.Float(), nullable=True),
        sa.Column("away_possession", sa.Float(), nullable=True),
        sa.Column("home_shots", sa.Integer(), nullable=True),
        sa.Column("away_shots", sa.Integer(), nullable=True),
        sa.Column("raw_stats", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_matches_api_id", "matches", ["api_id"], unique=True)
    op.create_index("ix_matches_kickoff_utc", "matches", ["kickoff_utc"])
    op.create_index("ix_matches_status", "matches", ["status"])

    op.create_table(
        "columns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phase", sa.String(length=60), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("group_ids", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("match_ids", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("scoring_config", postgresql.JSONB(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_columns_status", "columns", ["status"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("avatar_emoji", sa.String(length=8), nullable=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_admin", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "ai_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("result", sa.String(length=10), nullable=False),
        sa.Column("score_home", sa.Integer(), nullable=True),
        sa.Column("score_away", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("prob_home", sa.Float(), nullable=True),
        sa.Column("prob_draw", sa.Float(), nullable=True),
        sa.Column("prob_away", sa.Float(), nullable=True),
        sa.Column("xg_home", sa.Float(), nullable=True),
        sa.Column("xg_away", sa.Float(), nullable=True),
        sa.Column("key_players", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("factors", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("summary_text", sa.String(length=400), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ai_predictions_match_id", "ai_predictions", ["match_id"])
    op.create_index("ix_ai_predictions_generated_at", "ai_predictions", ["generated_at"])

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("column_id", sa.Integer(), sa.ForeignKey("columns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pred_home_score", sa.Integer(), nullable=False),
        sa.Column("pred_away_score", sa.Integer(), nullable=False),
        sa.Column("pred_yellows", sa.Integer(), nullable=True),
        sa.Column("pred_reds", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("locked", sa.Boolean(), nullable=True),
        sa.UniqueConstraint("user_id", "match_id", "column_id", name="uq_prediction_user_match_column"),
    )
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"])
    op.create_index("ix_predictions_match_id", "predictions", ["match_id"])
    op.create_index("ix_predictions_column_id", "predictions", ["column_id"])

    op.create_table(
        "scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("prediction_id", sa.Integer(), sa.ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pts_result", sa.Integer(), nullable=True),
        sa.Column("pts_exact", sa.Integer(), nullable=True),
        sa.Column("pts_yellows", sa.Integer(), nullable=True),
        sa.Column("pts_reds", sa.Integer(), nullable=True),
        sa.Column("pts_bonus", sa.Integer(), nullable=True),
        sa.Column("total", sa.Integer(), nullable=True),
    )
    op.create_index("ix_scores_prediction_id", "scores", ["prediction_id"], unique=True)
    op.create_index("ix_scores_total", "scores", ["total"])


def downgrade() -> None:
    op.drop_table("scores")
    op.drop_table("predictions")
    op.drop_table("ai_predictions")
    op.drop_table("users")
    op.drop_table("columns")
    op.drop_table("matches")
    op.drop_table("groups")
