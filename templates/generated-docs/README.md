<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Generated documentation template

This runnable fixture demonstrates [tool-first usability](../../docs/tool-usability.md)
with Sphinx, sphinx-click, Task 3.54.0, and Coverage.py. It is not a robot
assessment implementation. Tooling stays inside its pinned Linux amd64 container;
Python and its dependencies are not host prerequisites. Dependency versions and
hashes are in `requirements.lock`; update deliberately from `requirements.in`.

From the guidelines repository root:

```sh
task docs:build
task docs:verify
```

Open `artifacts/generated-docs/html/index.html` after verification. The artifact
contains conceptual guidance, generated Click reference, actual terminal help,
Task descriptions and commands, and measured software test coverage. The
container runs verification without network access. Building the image requires
access to its pinned public dependencies. An existing provider trust bundle can
be passed with `HOST_BUILD_CA_FILE`; certificate verification stays enabled.

Inside the prepared container, use:

```sh
python -m fixture --help
python -m fixture example.json
task test
task docs
task check
```

The example accepts exactly one JSON object with a non-empty `name` string;
`example.json` contains a valid input. Extra fields, a list, an empty name, and
malformed JSON fail. Help and errors show how to try a valid example. Options are
rendered from the command itself, not repeated in this README.

`task docs` writes a new output directory and refuses to overwrite existing
output. Start a fresh disposable container for repeated verification, or choose
a new directory with `python generate.py PATH`. The host `docs:verify` task replaces only its generated artifact directory.
`task test` records coverage; without that input, the generated page explicitly
says coverage is unavailable. Software test coverage does not grade robot quality.

The tests verify changed help and Task descriptions reach HTML, repeat builds
produce identical artifacts, local broken links fail, environment secrets do not
appear, and task bodies are not executed while documenting them. The generator
uses reviewed source files and sanitized subprocess environments; arbitrary
Taskfile variables and imported Python can execute code, so review them first.
Coverage HTML includes source; publish only appropriate public code.

Copy this directory at an approved published version tag, adapt `fixture.cli:cli`
in `guide/command.rst`, the help invocation in `generate.py`, the coverage scope,
and the project's Taskfile. Replace the teaching tests with project-specific
contract examples while retaining documentation tests. Keep the license notices.
The [GitHub pipeline](../../.github/workflows/generated-docs.yml) is a starting
point for artifact publication, not public website deployment. Other providers
and cross-platform execution are not verified by this fixture.
