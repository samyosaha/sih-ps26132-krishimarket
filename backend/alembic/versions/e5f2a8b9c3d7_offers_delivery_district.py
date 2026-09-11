"""Add delivery_district to offers table

Revision ID: e5f2a8b9c3d7
Revises: d1e4f9a2b3c5
Create Date: 2026-09-11 00:00:00.000000

What this migration does
------------------------
Adds a nullable ``delivery_district`` VARCHAR column to the ``offers`` table.

This column captures the buyer's delivery district as a plain string at the
time they request a fulfillment recommendation or submit an offer.  It is
intentionally *not* a FK — districts are resolved to their nearest Hub on
demand by ``hub_service.match_hub()``, which already exists from Step 2.

Safety notes
------------
* Column is nullable — all existing offer rows default to NULL. No data loss.
* SQLite batch_alter_table is used for compatibility.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f2a8b9c3d7"
down_revision: Union[str, Sequence[str], None] = "d1e4f9a2b3c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    offer_columns = {col["name"] for col in inspector.get_columns("offers")}

    if "delivery_district" not in offer_columns:
        with op.batch_alter_table("offers", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("delivery_district", sa.String(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        try:
            batch_op.drop_column("delivery_district")
        except Exception:
            pass
