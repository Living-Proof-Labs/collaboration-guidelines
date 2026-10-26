.. SPDX-License-Identifier: CC-BY-4.0

Concepts and first use
======================

Start with ``python -m fixture --help``. The fixture accepts exactly one JSON
object containing a non-empty ``name`` string. Try the included example with
``python -m fixture example.json``. A list, extra fields, or an empty name is
rejected rather than silently converted.

The example demonstrates actionable help and strict validation. It does not
implement a robot capability schema. See :doc:`command` for generated options,
:doc:`terminal-help` for the actual terminal help, and :doc:`tasks` for commands
available in the prepared container.
