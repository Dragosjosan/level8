"""Create canonical curves and application settings tables."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "curves",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("peak_level", sa.Float(), nullable=False),
        sa.Column("time_elapsed", sa.Float(), nullable=False),
        sa.Column("measured_level", sa.Float(), nullable=False),
        sa.Column("weekly_infusions", sa.JSON(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False),
        sa.Column("is_constant", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(length=24), nullable=False),
        sa.Column("updated_at", sa.String(length=24), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_table("curves")
