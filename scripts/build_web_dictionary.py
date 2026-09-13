import json
import sqlite3
from pathlib import Path


LIMIT = 10_000
SOURCE = Path('assets/dictionary/ecdict-core.db')
OUTPUT = Path('assets/dictionary/web-core.json')


def main():
    connection = sqlite3.connect(SOURCE)
    rows = connection.execute(
        'select word, phonetic, translation, tags from entries '
        'order by case when frequency = 0 then 1 else 0 end, frequency asc, word asc limit ?',
        (LIMIT,),
    ).fetchall()
    entries = []
    for word, phonetic, translation, tags in rows:
        lines = [
            line.strip()
            for line in translation.replace('\\n', '\n').splitlines()
            if line.strip() and not line.strip().startswith('[网络]')
        ]
        entries.append([word, phonetic, '\n'.join(lines[:3]), tags])
    words = {word.lower() for word, _, _, _ in entries}
    aliases = {
        alias.lower(): lemma.lower()
        for alias, lemma in connection.execute('select alias, lemma from aliases order by alias asc')
        if lemma.lower() in words and alias.lower() not in words
    }
    payload = {
        'version': 1,
        'source': 'ECDICT Core for Shuyu',
        'license': 'MIT',
        'entryCount': len(entries),
        'aliasCount': len(aliases),
        'entries': entries,
        'aliases': aliases,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'generated {OUTPUT}: {OUTPUT.stat().st_size} bytes, {len(entries)} entries, {len(aliases)} aliases')


if __name__ == '__main__':
    main()
