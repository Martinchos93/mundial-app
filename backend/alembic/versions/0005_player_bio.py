"""player bio + wiki url, widen photo_url

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("players", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("wiki_url", sa.String(length=400), nullable=True))
    op.alter_column("players", "photo_url", type_=sa.String(length=400))


def downgrade() -> None:
    op.drop_column("players", "wiki_url")
    op.drop_column("players", "bio")
