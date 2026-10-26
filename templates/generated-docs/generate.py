# SPDX-License-Identifier: Apache-2.0
"""Generate reference pages from reviewed executable definitions, never run tasks."""
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


def run(*args):
    # Do not pass authentication variables or user configuration into renderers.
    env = {"PATH": os.environ["PATH"], "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
           "PYTHONPATH": str(ROOT), "PYTHONHASHSEED": "0", "NO_COLOR": "1",
           "SOURCE_DATE_EPOCH": os.environ.get("SOURCE_DATE_EPOCH", "0")}
    return subprocess.check_output(args, cwd=ROOT, env=env, text=True, stderr=subprocess.STDOUT)


def literal(text):
    return ".. code-block:: text\n\n" + "\n".join("   " + line for line in text.splitlines()) + "\n\n"


def build(destination):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError("Choose a new output directory; existing output is never overwritten")
    with tempfile.TemporaryDirectory() as temporary:
        source = Path(temporary) / "source"
        shutil.copytree(ROOT / "guide", source)
        tasks = json.loads(run("task", "--list", "--json"))["tasks"]
        reference = "Task reference\n==============\n\n"
        for task in sorted(tasks, key=lambda task: task["name"]):
            name = task["name"]
            reference += name + "\n" + "-" * len(name) + "\n\n"
            reference += literal(task["desc"])
            reference += literal(run("task", name, "--summary"))
        (source / "tasks.rst").write_text(reference)
        (source / "terminal-help.rst").write_text(
            "Terminal help\n=============\n\n" + literal(run(sys.executable, "-m", "fixture", "--help")))
        run("sphinx-build", "-q", "-W", "--keep-going", "-n", "-b", "html", "-d", str(Path(temporary) / "doctrees"), str(source), str(destination))
    if (ROOT / ".coverage").exists():
        run("coverage", "html", "-d", str(destination / "coverage"))
        # Coverage.py emits wall-clock footer text and a path-dependent cache.
        # Exclude only that build metadata; retain all measured coverage content.
        (destination / "coverage/status.json").unlink(missing_ok=True)
        for page in (destination / "coverage").glob("*.html"):
            page.write_text(re.sub(r"created at \d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{4}",
                                   "generated from measured test coverage", page.read_text()))
    else:
        # An explicit absence is useful; never fabricate a percentage.
        (destination / "coverage").mkdir()
        (destination / "coverage/index.html").write_text("<!doctype html><title>Coverage unavailable</title><p>No test coverage data was supplied. Run task test first.</p>")
    from links import check_links
    check_links(destination)


if __name__ == "__main__":
    build(sys.argv[1])
