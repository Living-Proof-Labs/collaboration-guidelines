# SPDX-License-Identifier: Apache-2.0
"""Prepare the released docs stylesheet; rendering only reads verified local bytes."""
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'artifacts/manual-brand/brand.css'


def lock():
    record = json.loads((ROOT / 'docs-brand.lock.json').read_text())
    if (record.get('repository') != 'Living-Proof-Labs/collaboration-guidelines'
            or record.get('path') != 'brand/docs/brand.css'
            or not re.fullmatch(r'v\d+\.\d+\.\d+', record.get('version', ''))
            or not re.fullmatch(r'[0-9a-f]{40}', record.get('commit', ''))
            or not re.fullmatch(r'[0-9a-f]{64}', record.get('sha256', ''))):
        raise ValueError('Expected a released docs brand tag, exact commit and SHA-256 lock')
    return record


def verify(data, record):
    actual = hashlib.sha256(data).hexdigest()
    if actual != record['sha256']:
        raise ValueError(f"Docs brand checksum mismatch: expected {record['sha256']}, got {actual}")
    return data


def stylesheet():
    return verify(CACHE.read_bytes(), lock())


def prepare():
    record = lock()
    url = (f"https://raw.githubusercontent.com/{record['repository']}/"
           f"{record['commit']}/{record['path']}")
    with urlopen(url, timeout=30) as response:
        data = verify(response.read(), record)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_bytes(data)


if __name__ == '__main__':
    prepare()
