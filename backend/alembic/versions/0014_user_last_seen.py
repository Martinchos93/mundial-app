"""Track user last_seen for 'active now' metrics."""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_last_seen", "users", ["last_seen"])


def downgrade() -> None:
    op.drop_index("ix_users_last_seen", table_name="users")
    op.drop_column("users", "last_seen")
