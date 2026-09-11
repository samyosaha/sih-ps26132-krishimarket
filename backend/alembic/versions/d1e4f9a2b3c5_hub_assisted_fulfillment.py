"""Hub-Assisted Fulfillment — hubs, transporters, lots.hub_id, delivery columns

Revision ID: d1e4f9a2b3c5
Revises: c4a82d4f7f11
Create Date: 2026-09-11 00:00:00.000000

What this migration does
------------------------
1. Creates ``hubs`` table — one row per distinct (market, district, state) in
   ``price_records``.  Every mandi in the Agmarknet data doubles as a logistics
   hub.  lat/lng are left NULL for now; a geocoding pass will populate them
   later.
2. Creates ``transporters`` table — registered local transporters.
3. Adds ``hub_id`` (nullable FK -> hubs) to the ``lots`` table.
4. Adds six delivery-tracking columns to ``transactions``:
   - delivery_method  (VARCHAR, default 'pending')
   - delivery_status  (VARCHAR, default 'listed')
   - hub_checkin_photo_url  (VARCHAR nullable)
   - hub_checkin_weight_kg  (FLOAT nullable)
   - hub_checkin_grade      (VARCHAR nullable)
   - estimated_delivery_cost (FLOAT nullable)

Safety notes
------------
* All existing ``lots`` rows get ``hub_id = NULL`` -- no data changed.
* All existing ``transactions`` rows get delivery_method='pending',
  delivery_status='listed' -- safe defaults, no loss.
* SQLite does not allow adding NOT NULL columns without defaults; we supply
  server_default on the ALTER so the single existing transaction row is
  populated correctly.
* batch_alter_table is used throughout for SQLite compatibility.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e4f9a2b3c5"
down_revision: Union[str, Sequence[str], None] = "c4a82d4f7f11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # ------------------------------------------------------------------
    # 1. Create hubs table
    # ------------------------------------------------------------------
    if "hubs" not in existing_tables:
        op.create_table(
            "hubs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("district", sa.String(), nullable=False),
            sa.Column("state", sa.String(), nullable=False),
            sa.Column("lat", sa.Float(), nullable=True),
            sa.Column("lng", sa.Float(), nullable=True),
            sa.Column(
                "has_kisan_rail_station",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column("kisan_rail_station_name", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "name", "district", "state",
                name="uq_hub_name_district_state",
            ),
        )
        op.create_index(op.f("ix_hubs_id"), "hubs", ["id"], unique=False)

        # Seed hubs from the distinct mandis already in price_records
        op.execute(
            sa.text(
                """
                INSERT INTO hubs (name, district, state, has_kisan_rail_station)
                SELECT DISTINCT market, district, state, 0
                FROM price_records
                WHERE market IS NOT NULL
                  AND district IS NOT NULL
                  AND state IS NOT NULL
                ORDER BY state, district, market
                """
            )
        )

    # ------------------------------------------------------------------
    # 2. Create transporters table
    # ------------------------------------------------------------------
    if "transporters" not in existing_tables:
        op.create_table(
            "transporters",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("district", sa.String(), nullable=False),
            sa.Column(
                "vehicle_type",
                sa.Enum(
                    "mini_truck", "medium_truck", "large_truck",
                    name="vehicletype",
                ),
                nullable=False,
            ),
            sa.Column("capacity_kg", sa.Float(), nullable=False),
            sa.Column(
                "verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_transporters_id"), "transporters", ["id"], unique=False
        )

    # ------------------------------------------------------------------
    # 3. Add hub_id to lots (nullable FK)
    # ------------------------------------------------------------------
    lots_columns = {col["name"] for col in inspector.get_columns("lots")}
    if "hub_id" not in lots_columns:
        with op.batch_alter_table("lots", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("hub_id", sa.Integer(), nullable=True)
            )
            batch_op.create_foreign_key(
                "fk_lots_hub_id_hubs",
                "hubs",
                ["hub_id"],
                ["id"],
            )

    # ------------------------------------------------------------------
    # 4. Add delivery-tracking columns to transactions
    # ------------------------------------------------------------------
    tx_columns = {col["name"] for col in inspector.get_columns("transactions")}

    new_tx_columns = []
    if "delivery_method" not in tx_columns:
        new_tx_columns.append(
            sa.Column(
                "delivery_method",
                sa.Enum(
                    "pending",
                    "buyer_pickup",
                    "local_transporter",
                    "kisan_rail",
                    "consolidated_truck",
                    name="deliverymethod",
                ),
                nullable=False,
                server_default="pending",
            )
        )
    if "delivery_status" not in tx_columns:
        new_tx_columns.append(
            sa.Column(
                "delivery_status",
                sa.Enum(
                    "listed",
                    "hub_checkin_pending",
                    "verified_at_hub",
                    "dispatched",
                    "in_transit",
                    "delivered",
                    "rejected",
                    "disputed",
                    name="deliverystatus",
                ),
                nullable=False,
                server_default="listed",
            )
        )
    if "hub_checkin_photo_url" not in tx_columns:
        new_tx_columns.append(
            sa.Column("hub_checkin_photo_url", sa.String(), nullable=True)
        )
    if "hub_checkin_weight_kg" not in tx_columns:
        new_tx_columns.append(
            sa.Column("hub_checkin_weight_kg", sa.Float(), nullable=True)
        )
    if "hub_checkin_grade" not in tx_columns:
        new_tx_columns.append(
            sa.Column("hub_checkin_grade", sa.String(), nullable=True)
        )
    if "estimated_delivery_cost" not in tx_columns:
        new_tx_columns.append(
            sa.Column("estimated_delivery_cost", sa.Float(), nullable=True)
        )

    if new_tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            for col in new_tx_columns:
                batch_op.add_column(col)


def downgrade() -> None:
    """Remove all Phase 7 additions.

    Existing lots and transactions are preserved; only the new columns and
    tables added by this migration are removed.
    """
    # Remove delivery columns from transactions
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        for col in [
            "estimated_delivery_cost",
            "hub_checkin_grade",
            "hub_checkin_weight_kg",
            "hub_checkin_photo_url",
            "delivery_status",
            "delivery_method",
        ]:
            try:
                batch_op.drop_column(col)
            except Exception:
                pass

    # Remove hub_id FK and column from lots
    with op.batch_alter_table("lots", schema=None) as batch_op:
        try:
            batch_op.drop_constraint("fk_lots_hub_id_hubs", type_="foreignkey")
        except Exception:
            pass
        try:
            batch_op.drop_column("hub_id")
        except Exception:
            pass

    # Drop new tables (transporters first, then hubs -- lots FK references hubs)
    op.drop_table("transporters")
    op.drop_table("hubs")
