"""players (national team squads)

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_name", sa.String(length=120), nullable=False),
        sa.Column("api_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.String(length=40), nullable=True),
        sa.Column("number", sa.Integer(), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("photo_url", sa.String(length=300), nullable=True),
    )
    op.create_index("ix_players_team_name", "players", ["team_name"])
    op.create_index("ix_players_team_name_name", "players", ["team_name", "name"])


def downgrade() -> None:
    op.drop_table("players")
