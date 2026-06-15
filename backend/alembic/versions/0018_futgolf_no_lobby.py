"""Promote any lingering FutGolf tables out of the 'lobby' state — no more
waiting on the creator to start."""
from typing import Union

from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE futgolf_tables SET status='playing', round_no=1, shots_allowed=3 WHERE status='lobby'"
    )


def downgrade() -> None:
    pass
