"""widen player photo_url / wiki_url to Text

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("players", "photo_url", type_=sa.Text())
    op.alter_column("players", "wiki_url", type_=sa.Text())


def downgrade() -> None:
    op.alter_column("players", "photo_url", type_=sa.String(length=400))
    op.alter_column("players", "wiki_url", type_=sa.String(length=400))
