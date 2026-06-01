"""player club / birth_date / season stats

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("players", sa.Column("club", sa.String(length=120), nullable=True))
    op.add_column("players", sa.Column("birth_date", sa.String(length=20), nullable=True))
    op.add_column("players", sa.Column("season_apps", sa.Integer(), nullable=True))
    op.add_column("players", sa.Column("season_goals", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "season_goals")
    op.drop_column("players", "season_apps")
    op.drop_column("players", "birth_date")
    op.drop_column("players", "club")
