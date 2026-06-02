"""Per-player goal/card prediction counts + red-card tracking.

Adds:
  - predictions.pred_players  JSONB  [{name, team, g, y, r}]
  - matches.red_players       ARRAY(String)  (subset of booked with a red)
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("predictions", sa.Column("pred_players", postgresql.JSONB(), nullable=True))
    op.add_column("matches", sa.Column("red_players", postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "red_players")
    op.drop_column("predictions", "pred_players")
