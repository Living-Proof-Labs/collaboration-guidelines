# SPDX-License-Identifier: Apache-2.0
"""Validate the same sealed, versioned manual before release and before Pages."""

import json
import re
import sys
import tarfile
from pathlib import Path

STABLE = r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
PREVIEW = rf"{STABLE}-(?:pr\.[1-9][0-9]*\.|main\.)[1-9][0-9]*\.[1-9][0-9]*"


def edition(version: str | None) -> str:
    if version is None:
        return "development"
    if re.fullmatch(STABLE, version):
        return "release"
    if re.fullmatch(PREVIEW, version):
        return "preview"
    raise ValueError("Expected an authoritative stable or preview documentation version")


def require_manifest(record, version, commit, run, attempt):
    kind = edition(version)
    expected = {
        "version": version,
        "edition": kind,
        "source_ref": f"v{version}" if kind == "release" else commit,
        "source_commit": commit,
        "source_dirty": False,
        "run_id": run,
        "run_attempt": attempt,
    }
    if not isinstance(record, dict) or any(
        record.get(key) != value for key, value in expected.items()
    ):
        raise ValueError(
            "Sealed manual identity does not match the planned version, source and run"
        )


def require_archive(path, version, commit, run, attempt):
    with tarfile.open(path, mode="r:") as archive:
        records = [item for item in archive if item.name in {"./build.json", "build.json"}]
        if len(records) != 1 or not records[0].isfile():
            raise ValueError("Expected one regular build.json in the sealed manual")
        with archive.extractfile(records[0]) as handle:
            require_manifest(json.load(handle), version, commit, run, attempt)


def main():
    mode, *args = sys.argv[1:]
    if mode == "seal":
        path, *identity = args
        require_manifest(json.loads(Path(path).read_text()), *identity)
    elif mode == "archive":
        require_archive(*args)
    else:
        raise ValueError("Expected seal or archive")


if __name__ == "__main__":
    main()
