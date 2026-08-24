"""Build the bundled Shuyu offline dictionary from a pinned ECDICT snapshot."""

from __future__ import annotations

import csv
import base64
import hashlib
import heapq
import json
import re
import sqlite3
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "ecdict-npm.csv"
ARCHIVE = ROOT / ".cache" / "ecdict-0.0.4.tgz"
OUTPUT = ROOT / "assets" / "dictionary" / "ecdict-core.db"
METADATA = ROOT / "assets" / "dictionary" / "metadata.json"
SOURCE_URL = "https://registry.npmjs.org/ecdict/-/ecdict-0.0.4.tgz"
SOURCE_INTEGRITY = "nFlK3dCARkW9/RbJSqFGVbXwKMX88dqBNf7C3GXpWsGX0omsHkfrYm2L+aNyD+ocK/3J85xrZaplh3oA6uG0Zg=="
ENTRY_LIMIT = 120_000
WORD_PATTERN = re.compile(r"^[A-Za-z][A-Za-z'’-]{0,47}$")
CORE_TAGS = {"zk", "gk", "cet4", "cet6", "ky", "ielts", "toefl", "gre"}


def download_source() -> None:
    if CACHE.exists() and CACHE.stat().st_size > 50_000_000:
        return
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        print("Downloading pinned ecdict@0.0.4 package…")
        urllib.request.urlretrieve(SOURCE_URL, ARCHIVE)
    digest = base64.b64encode(hashlib.sha512(ARCHIVE.read_bytes()).digest()).decode("ascii")
    if digest != SOURCE_INTEGRITY:
        raise RuntimeError("ecdict@0.0.4 integrity check failed")
    with tarfile.open(ARCHIVE, "r:gz") as package:
        source = package.extractfile("package/assets/ecdict.csv")
        if source is None:
            raise RuntimeError("ecdict package does not contain assets/ecdict.csv")
        CACHE.write_bytes(source.read())


def integer(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def entry_rank(row: dict[str, str]) -> int:
    tags = set((row.get("tag") or "").lower().split())
    bnc = integer(row.get("bnc"))
    frq = integer(row.get("frq"))
    frequencies = [value for value in (bnc, frq) if value > 0]
    frequency = min(frequencies, default=999_999)
    if row.get("oxford") == "1":
        bucket = 0
    elif tags & CORE_TAGS:
        bucket = 1
    elif frequencies:
        bucket = 2
    else:
        bucket = 3
    return bucket * 1_000_000_000 + frequency * 100 + min(len(row.get("word") or ""), 99)


def lemma_from_exchange(exchange: str) -> str | None:
    for part in exchange.split("/"):
        if part.startswith("0:") and len(part) > 2:
            return part[2:].strip().lower()
    return None


def select_entries() -> tuple[list[tuple[str, str, str, str, int]], dict[str, str]]:
    heap: list[tuple[int, int, tuple[str, str, str, str, int]]] = []
    aliases: dict[str, str] = {}
    serial = 0
    with CACHE.open("r", encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            word = (row.get("word") or "").strip().lower()
            translation = (row.get("translation") or "").strip()
            if not translation or not WORD_PATTERN.fullmatch(word):
                continue
            lemma = lemma_from_exchange(row.get("exchange") or "")
            if lemma and WORD_PATTERN.fullmatch(lemma):
                aliases[word] = lemma
            frequencies = [value for value in (integer(row.get("bnc")), integer(row.get("frq"))) if value > 0]
            record = (
                word,
                (row.get("phonetic") or "").strip(),
                translation,
                (row.get("tag") or "").strip(),
                min(frequencies, default=0),
            )
            rank = entry_rank(row)
            item = (-rank, serial, record)
            serial += 1
            if len(heap) < ENTRY_LIMIT:
                heapq.heappush(heap, item)
            elif item[0] > heap[0][0]:
                heapq.heapreplace(heap, item)
    entries = sorted((item[2] for item in heap), key=lambda item: item[0])
    return entries, aliases


def build_database(entries: list[tuple[str, str, str, str, int]], aliases: dict[str, str]) -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()
    selected_words = {entry[0] for entry in entries}
    usable_aliases = sorted(
        (alias, lemma) for alias, lemma in aliases.items()
        if alias not in selected_words and lemma in selected_words
    )
    database = sqlite3.connect(OUTPUT)
    try:
        database.executescript("""
            PRAGMA page_size = 4096;
            PRAGMA journal_mode = DELETE;
            PRAGMA synchronous = OFF;
            CREATE TABLE entries (
              word TEXT PRIMARY KEY COLLATE NOCASE,
              phonetic TEXT NOT NULL,
              translation TEXT NOT NULL,
              tags TEXT NOT NULL,
              frequency INTEGER NOT NULL
            ) WITHOUT ROWID;
            CREATE TABLE aliases (
              alias TEXT PRIMARY KEY COLLATE NOCASE,
              lemma TEXT NOT NULL
            ) WITHOUT ROWID;
        """)
        database.executemany(
            "INSERT OR REPLACE INTO entries(word, phonetic, translation, tags, frequency) VALUES (?, ?, ?, ?, ?)",
            entries,
        )
        database.executemany("INSERT OR REPLACE INTO aliases(alias, lemma) VALUES (?, ?)", usable_aliases)
        database.execute(f"PRAGMA user_version = 1")
        database.commit()
        database.execute("VACUUM")
    finally:
        database.close()
    return len(usable_aliases)


def main() -> None:
    download_source()
    entries, aliases = select_entries()
    alias_count = build_database(entries, aliases)
    source_sha256 = hashlib.sha256(CACHE.read_bytes()).hexdigest()
    metadata = {
        "name": "ECDICT Core for Shuyu",
        "version": 1,
        "entryCount": len(entries),
        "aliasCount": alias_count,
        "source": "ecdict@0.0.4 (derived from skywind3000/ECDICT)",
        "sourceIntegrity": f"sha512-{SOURCE_INTEGRITY}",
        "sourceSha256": source_sha256,
        "license": "MIT",
    }
    METADATA.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} with {len(entries):,} entries and {alias_count:,} aliases")
    print(f"Database size: {OUTPUT.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
