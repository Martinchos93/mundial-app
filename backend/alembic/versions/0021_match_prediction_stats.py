"""Match.prediction_stats: aggregated prediction stats per match."""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("prediction_stats", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("matches", "prediction_stats")
