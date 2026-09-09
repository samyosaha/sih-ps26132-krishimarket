import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./krishimarket.db"

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Columns added after the first create_all() run. SQLite will not ALTER
# existing tables automatically, so /auth/me and dispute resolution 500.
_SQLITE_COLUMN_PATCHES: dict[str, list[tuple[str, str]]] = {
    "users": [
        ("preferred_language", "VARCHAR DEFAULT 'en'"),
        ("phone_verified", "BOOLEAN DEFAULT 0"),
        ("average_rating", "FLOAT"),
        ("total_ratings", "INTEGER DEFAULT 0 NOT NULL"),
    ],
    "disputes": [
        ("resolution_notes", "TEXT"),
        ("resolved_by_id", "INTEGER"),
        ("resolved_at", "DATETIME"),
        ("outcome", "VARCHAR"),
    ],
}


def ensure_sqlite_schema() -> None:
    """Add missing columns on SQLite so SQLAlchemy models match the file DB."""
    if not str(DATABASE_URL).startswith("sqlite"):
        return
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in _SQLITE_COLUMN_PATCHES.items():
            if table not in tables:
                continue
            existing = {col["name"] for col in inspect(engine).get_columns(table)}
            for name, ddl in columns:
                if name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()