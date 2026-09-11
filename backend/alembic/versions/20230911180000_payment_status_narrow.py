"""Migration to narrow PaymentStatus enum from pending/paid/delivered to pending/paid/failed and convert existing 'delivered' rows to 'paid'."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20230911180000_payment_status_narrow'
down_revision = 'e5f2a8b9c3d7'
branch_labels = None
depends_on = None

def upgrade():
    # Convert existing rows where payment_status was 'delivered' to 'paid'
    op.execute("UPDATE transactions SET payment_status='paid' WHERE payment_status='delivered'")
    # Alter column to new enum (SQLite uses batch_alter_table)
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.alter_column('payment_status',
            existing_type=sa.Enum('pending','paid','delivered', name='paymentstatus'),
            type_=sa.Enum('pending','paid','failed', name='paymentstatus'),
            existing_nullable=False,
            server_default='pending')

def downgrade():
    # Revert column enum back to original
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.alter_column('payment_status',
            existing_type=sa.Enum('pending','paid','failed', name='paymentstatus'),
            type_=sa.Enum('pending','paid','delivered', name='paymentstatus'),
            existing_nullable=False,
            server_default='pending')
    # NOTE: rows that were changed from 'delivered' to 'paid' cannot be distinguished, so data is not restored.
