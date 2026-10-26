# SPDX-License-Identifier: Apache-2.0
import json
import pytest
from click.testing import CliRunner
from fixture.cli import cli


def test_help_teaches_input_and_next_command():
    result = CliRunner().invoke(cli, ["--help"])
    assert result.exit_code == 0
    for text in ["JSON object", "example.json", "task docs", "--format"]:
        assert text in result.output


@pytest.mark.parametrize("value", [[], {}, {"name": ""}, {"name": 2}, {"name": "Ada", "extra": 1}])
def test_invalid_structure_stays_invalid_with_actionable_error(tmp_path, value):
    path = tmp_path / "input.json"
    path.write_text(json.dumps(value))
    result = CliRunner().invoke(cli, [str(path)])
    assert result.exit_code != 0
    assert 'Expected exactly' in result.output
    assert 'python -m fixture example.json' in result.output
    assert ("input is a list" in result.output) == isinstance(value, list)


def test_malformed_input_does_not_echo_sensitive_content(tmp_path):
    path = tmp_path / "input.json"
    path.write_text("secret-not-json")
    result = CliRunner().invoke(cli, [str(path)])
    assert result.exit_code != 0
    assert "not valid JSON" in result.output
    assert "secret-not-json" not in result.output


@pytest.mark.parametrize("output_format", ["text", "json"])
def test_documented_example(output_format):
    result = CliRunner().invoke(cli, ["example.json", "--format", output_format])
    assert result.exit_code == 0
    assert "Ada" in result.output


@pytest.mark.parametrize("arguments", [[], ["missing.json"], ["--unknown"]])
def test_usage_errors_offer_a_valid_example(arguments):
    result = CliRunner().invoke(cli, arguments)
    assert result.exit_code != 0
    assert "python -m fixture example.json" in result.output
    assert "python -m fixture --help" in result.output
