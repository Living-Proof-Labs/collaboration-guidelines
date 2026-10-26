<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Tools that teach their own use

A person should be able to make the next useful move from the command's help or
error message without first finding a README. State the expected input and its
meaning, show an actionable example, and name the next command. Keep examples in
help definitions so terminal help and generated reference pages stay consistent.

When an error provides evidence of a likely mistake, explain it concretely: for
example, "Expected one JSON object; the input is a list." Do not guess a cause
that was not observed. Follow the explanation with a valid example or a recovery
command. Keep schema paths, internal diagnostics, and tracebacks secondary; offer
them when needed for diagnosis without making them the only explanation.
Never echo secrets or an entire rejected document into an error.

Better messages do not mean weaker validation. Preserve nonzero failure exits,
required fields, types, constraints, and evidence requirements. Do not silently
coerce invalid input or reinterpret it as success. Test missing and malformed
input as well as the documented successful example. README instructions, tool
help, and generated documentation must agree on commands and input contracts.

## Generate reference pages from the actual tools

Use the [generated documentation template](../templates/generated-docs/README.md)
for a small Click-based example. Sphinx with sphinx-click imports the actual
command definitions; a terminal-help page also captures the command's real
`--help` output. Task's native `--list --json` and `--summary` provide descriptions
and task commands. These capabilities were exercised with Task **3.54.0**; this
is a small adapter into Sphinx, not a claim that Task natively builds a website.

Keep hand-authored concepts, input semantics, and first-use explanations separate
from generated reference pages, with links between them. Do not maintain a second
manual copy of command options. Where test coverage exists, include its generated
HTML and name its scope clearly: **software test coverage is not robot quality,
capability, safety, or sufficiency of evidence**. If coverage is absent, say so;
never invent a percentage or imply a report was measured.

For projects with executable feature scenarios, generate browsable behavior pages
from those same scenarios and link them to their results at the tested revision.
Keep [feature/scenario coverage](developer-interface.md#observable-behavior-and-feature-coverage)
distinct from generated line-coverage HTML, with skipped, untested, and unspecified
behavior visible as limits. Combine applicable Click help, scenario documentation,
Task reference, and measured coverage in the repository's existing documentation
build, reachable from its README. Do not hand-maintain duplicate reference text.
The current template supplies Click, Task, and line coverage; scenario rendering
and result mapping must be added and verified in a consuming project that uses
them. This guidance does not claim that integration already exists.

Use Task to build and check the documentation inside the repository's tooling
container. Continuous integration calls those same tasks and uses standard
Actions for test summaries and retained artifacts. Start by uploading a reviewable
HTML artifact; public Pages deployment, extra permissions, and provider settings
need separately approved scope. See the [GitHub artifact pipeline](../.github/GENERATED-DOCS.md).

Treat imports and Taskfiles as executable repository code. Use reviewed sources,
no credentials, a narrow source allowlist, and no environment dump. Task listing
can evaluate dynamic variables even though it does not execute task bodies;
do not point this generator at arbitrary untrusted Taskfiles. Check the generated
artifact for sensitive content before publication, especially coverage pages,
which include source code. A sentinel test is a regression check, not a universal
secret detector.

The template checks local links and fragments and treats Sphinx warnings as
failures. External link availability is a separate online check, not claimed by
the offline build. Determinism applies to the pinned Linux tooling with identical
sources and coverage input. Coverage's incremental cache and wall-clock footer
are excluded from the published artifact; measured coverage is preserved.

## Adopt after review and release

Copy the template from an explicit published guidelines version tag and record
that tag in the consuming repository. Read its guidance at the same version.
The current `v4.1.0` release predates this template. For review only,
`feat/tool-first-generated-docs` is a temporary development reference; replace it
with the first approved release containing this template before normal adoption.
Do not invent a future version or move an existing tag.

Proposed reporter adoption is a separate change after the template is released:
point sphinx-click at its actual command, use its reviewed Taskfile, link its
conceptual guides, and generate coverage from its own tests. Coordinate with the
reporter's ongoing usability work rather than copying this fixture's input
contract or modifying that work here. No reporter adoption is included.

Primary references: [Click help](https://click.palletsprojects.com/en/stable/documentation/),
[sphinx-click](https://sphinx-click.readthedocs.io/en/stable/usage/),
[Sphinx builders](https://www.sphinx-doc.org/en/master/usage/builders/index.html),
[Task information commands](https://taskfile.dev/docs/reference/cli), and
[Coverage.py HTML](https://coverage.readthedocs.io/en/latest/commands/cmd_html.html).
