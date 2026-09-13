import json
from pathlib import Path


def main():
    path = Path('assets/dictionary/web-core.json')
    data = json.loads(path.read_text(encoding='utf-8'))
    entries = data['entries']
    aliases = data['aliases']
    words = {entry[0] for entry in entries}
    assert data['entryCount'] == 10_000
    assert data['license'] == 'MIT'
    assert len(entries) == data['entryCount'] == len(words)
    assert data['aliasCount'] == len(aliases)
    assert all(len(entry) == 4 and entry[0] == entry[0].lower() for entry in entries)
    assert all(target in words for target in aliases.values())
    for word in ('book', 'quiet', 'read'):
        assert word in words, word
    print(f'OK: Web offline dictionary checks passed ({len(entries):,} entries, {len(aliases):,} aliases)')


if __name__ == '__main__':
    main()
