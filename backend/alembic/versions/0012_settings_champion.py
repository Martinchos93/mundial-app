"""App settings (feature flags) + champion prediction."""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=80), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "champion_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("column_id", sa.Integer(), sa.ForeignKey("columns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_name", sa.String(length=120), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "column_id", name="uq_champion_user_column"),
    )
    op.create_index("ix_champion_predictions_user_id", "champion_predictions", ["user_id"])
    op.create_index("ix_champion_predictions_column_id", "champion_predictions", ["column_id"])


def downgrade() -> None:
    op.drop_index("ix_champion_predictions_column_id", table_name="champion_predictions")
    op.drop_index("ix_champion_predictions_user_id", table_name="champion_predictions")
    op.drop_table("champion_predictions")
    op.drop_table("app_settings")
