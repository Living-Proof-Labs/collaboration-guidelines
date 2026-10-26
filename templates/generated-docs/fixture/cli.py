# SPDX-License-Identifier: Apache-2.0
"""Small teaching fixture, not a robot assessment tool."""
import json
from pathlib import Path

import click


class TeachingCommand(click.Command):
    def parse_args(self, ctx, args):
        try:
            return super().parse_args(ctx, args)
        except click.UsageError as error:
            error.message += ("\nExpected a JSON input file. Try: python -m fixture example.json; "
                              "inspect options with python -m fixture --help.")
            raise


@click.command(cls=TeachingCommand, epilog="Example: python -m fixture example.json\n\nNext: task docs")
@click.argument("input_file", type=click.Path(path_type=Path, exists=True, dir_okay=False))
@click.option("--format", "output_format", type=click.Choice(["text", "json"]), default="text",
              show_default=True, help="Choose the output representation.")
def cli(input_file, output_format):
    """Read INPUT_FILE, a JSON object with a non-empty string named 'name'.

    This example validates input; it does not grade robot capability.
    Use example.json to try a valid input before supplying your own file.
    """
    try:
        data = json.loads(input_file.read_text())
    except (ValueError, UnicodeError):
        raise click.ClickException(
            "Expected a JSON object with a name string. This file is not valid JSON. "
            "Try: python -m fixture example.json; inspect options with python -m fixture --help."
        ) from None
    if not isinstance(data, dict) or set(data) != {"name"} or not isinstance(data["name"], str) or not data["name"].strip():
        hint = " The input is a list, but one object is required." if isinstance(data, list) else ""
        raise click.ClickException(
            'Expected exactly {"name": "Ada"} with a non-empty name.' + hint +
            " Try: python -m fixture example.json; then replace the example with your object."
        )
    click.echo(json.dumps(data, sort_keys=True) if output_format == "json" else f"Hello, {data['name']}.")
