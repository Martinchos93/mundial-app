"""FutGolf game: tables, participants, attempts."""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "futgolf_tables",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="lobby", index=True, nullable=False),
        sa.Column("course_seed", sa.Integer(), server_default="1", nullable=False),
        sa.Column("round_no", sa.Integer(), server_default="0", nullable=False),
        sa.Column("shots_allowed", sa.Integer(), server_default="3", nullable=False),
        sa.Column("winner_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "futgolf_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("table_id", sa.Integer(), sa.ForeignKey("futgolf_tables.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
    )
    op.create_table(
        "futgolf_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("table_id", sa.Integer(), sa.ForeignKey("futgolf_tables.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("round_no", sa.Integer(), index=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("sunk", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("shots", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("futgolf_attempts")
    op.drop_table("futgolf_participants")
    op.drop_table("futgolf_tables")
