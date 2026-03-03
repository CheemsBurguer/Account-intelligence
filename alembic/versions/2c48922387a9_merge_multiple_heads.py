"""Merge multiple heads

Revision ID: 2c48922387a9
Revises: 4d433f8c3c93, 6ad7c9305fc3
Create Date: 2026-03-02 17:36:15.714693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c48922387a9'
down_revision: Union[str, Sequence[str], None] = ('4d433f8c3c93', '6ad7c9305fc3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
