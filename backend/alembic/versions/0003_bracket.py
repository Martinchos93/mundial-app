"""knockout bracket fields on matches

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("match_no", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("home_source", sa.String(length=40), nullable=True))
    op.add_column("matches", sa.Column("away_source", sa.String(length=40), nullable=True))
    op.create_index("ix_matches_match_no", "matches", ["match_no"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_matches_match_no", table_name="matches")
    op.drop_column("matches", "away_source")
    op.drop_column("matches", "home_source")
    op.drop_column("matches", "match_no")
