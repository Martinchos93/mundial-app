"""Match.advances: knockout penalty-shootout qualifier (1=home, 2=away)."""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("advances", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "advances")
