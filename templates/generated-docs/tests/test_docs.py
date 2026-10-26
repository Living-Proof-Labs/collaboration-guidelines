# SPDX-License-Identifier: Apache-2.0
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import pytest
from generate import ROOT, build
from links import check_links


def inventory(path):
    return {str(file.relative_to(path)): hashlib.sha256(file.read_bytes()).hexdigest()
            for file in path.rglob("*") if file.is_file()}


def test_output_is_deterministic_and_excludes_environment_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "sentinel-secret-never-publish")
    build(tmp_path / "one")
    build(tmp_path / "two")
    assert inventory(tmp_path / "one") == inventory(tmp_path / "two")
    for file in (tmp_path / "one").rglob("*"):
        if file.is_file():
            assert b"sentinel-secret-never-publish" not in file.read_bytes()


def test_changed_command_help_and_tasks_reach_html(tmp_path):
    checkout = tmp_path / "fixture"
    shutil.copytree(ROOT, checkout, ignore=shutil.ignore_patterns("artifacts", "__pycache__", ".pytest_cache"))
    cli = checkout / "fixture/cli.py"
    cli.write_text(cli.read_text().replace("Choose the output representation.", "Changed help from the command definition."))
    taskfile = checkout / "Taskfile.yml"
    taskfile.write_text(taskfile.read_text().replace("Generate HTML from Click, Task and existing test coverage", "Changed description from Task"))
    subprocess.run([sys.executable, "generate.py", "artifacts/html"], cwd=checkout, check=True)
    assert "Changed help from the command definition." in (checkout / "artifacts/html/command.html").read_text()
    assert "Changed help from the command definition." in (checkout / "artifacts/html/terminal-help.html").read_text()
    assert "Changed description from Task" in (checkout / "artifacts/html/tasks.html").read_text()


@pytest.mark.parametrize("link", ["missing.html", "index.html#missing-fragment", "../outside.html"])
def test_broken_local_links_fail(tmp_path, link):
    (tmp_path / "index.html").write_text(f'<a href="{link}">broken</a>')
    with pytest.raises(ValueError, match="Broken local"):
        check_links(tmp_path)


def test_generated_reference_and_coverage_are_linked():
    output = ROOT / "artifacts/html"
    check_links(output)
    for name in ["command.html", "terminal-help.html", "tasks.html", "coverage/index.html"]:
        assert (output / name).is_file()
    assert "not robot quality" in (output / "coverage/index.html").read_text()


def test_missing_coverage_is_explicit_and_tasks_are_not_executed(tmp_path):
    checkout = tmp_path / "fixture"
    shutil.copytree(ROOT, checkout, ignore=shutil.ignore_patterns("artifacts", ".coverage", "__pycache__", ".pytest_cache"))
    taskfile = checkout / "Taskfile.yml"
    taskfile.write_text(taskfile.read_text() + "  never-run:\n    desc: Listing must not execute this task\n    cmds:\n      - touch execution-marker\n")
    subprocess.run([sys.executable, "generate.py", "artifacts/html"], cwd=checkout, check=True)
    assert not (checkout / "execution-marker").exists()
    assert "No test coverage data" in (checkout / "artifacts/html/coverage/index.html").read_text()
