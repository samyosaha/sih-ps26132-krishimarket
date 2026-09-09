"""repair constraints omitted by the legacy SQLite schema patch

Revision ID: c4a82d4f7f11
Revises: b7e3a9c1d2f0
Create Date: 2026-09-10 00:00:00.000000

Older local databases were brought up to date with ``ALTER TABLE ADD
COLUMN`` at application start. SQLite cannot add NOT NULL constraints or a
foreign key that way, so those databases need this one-time repair. Fresh
databases already created by the Phase 6 migration are detected and left
unchanged.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4a82d4f7f11"
down_revision: Union[str, Sequence[str], None] = "b7e3a9c1d2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"]: column for column in inspector.get_columns("users")}

    requires_language_constraint = user_columns["preferred_language"]["nullable"]
    requires_phone_constraint = user_columns["phone_verified"]["nullable"]

    if requires_language_constraint or requires_phone_constraint:
        op.execute(
            sa.text(
                "UPDATE users SET preferred_language = 'en' "
                "WHERE preferred_language IS NULL"
            )
        )
        op.execute(
            sa.text(
                "UPDATE users SET phone_verified = false "
                "WHERE phone_verified IS NULL"
            )
        )
        with op.batch_alter_table("users", schema=None) as batch_op:
            if requires_language_constraint:
                batch_op.alter_column(
                    "preferred_language", existing_type=sa.String(), nullable=False
                )
            if requires_phone_constraint:
                batch_op.alter_column(
                    "phone_verified", existing_type=sa.Boolean(), nullable=False
                )

    has_resolver_foreign_key = any(
        foreign_key.get("constrained_columns") == ["resolved_by_id"]
        and foreign_key.get("referred_table") == "users"
        for foreign_key in inspector.get_foreign_keys("disputes")
    )
    if not has_resolver_foreign_key:
        with op.batch_alter_table("disputes", schema=None) as batch_op:
            batch_op.create_foreign_key(
                "fk_disputes_resolved_by_id_users",
                "users",
                ["resolved_by_id"],
                ["id"],
            )


def downgrade() -> None:
    """This one-time legacy repair is intentionally not reversible."""
    raise NotImplementedError(
        "The legacy schema repair cannot be downgraded safely. Restore a database backup instead."
    )
