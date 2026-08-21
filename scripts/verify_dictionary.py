"""Verify the generated offline dictionary before packaging the app."""

import sqlite3
from pathlib import Path

database_path = Path(__file__).resolve().parents[1] / "assets" / "dictionary" / "ecdict-core.db"
database = sqlite3.connect(database_path)
try:
    entry_count = database.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    alias_count = database.execute("SELECT COUNT(*) FROM aliases").fetchone()[0]
    assert entry_count == 120_000, f"expected 120,000 entries, found {entry_count:,}"
    assert alias_count > 20_000, f"alias table is unexpectedly small: {alias_count:,}"
    for word in ("observatory", "curious", "possibility", "language", "reader"):
        row = database.execute(
            "SELECT phonetic, translation FROM entries WHERE word = ? COLLATE NOCASE",
            (word,),
        ).fetchone()
        assert row and row[1].strip(), f"missing core word: {word}"
finally:
    database.close()

print(f"OK: Offline dictionary checks passed ({entry_count:,} entries, {alias_count:,} aliases)")
