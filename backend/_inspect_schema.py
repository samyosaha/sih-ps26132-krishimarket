import sqlite3
from pathlib import Path

db = Path("krishimarket.db")
print("exists", db.exists())
if not db.exists():
    raise SystemExit(0)
c = sqlite3.connect(db)
cur = c.cursor()
tables = [
    row[0]
    for row in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
]
print("tables", tables)
for name in tables:
    cols = [row[1] for row in cur.execute(f"PRAGMA table_info({name})")]
    n = cur.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"{name}: {n} rows | {cols}")
