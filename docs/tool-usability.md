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
Actions for test summaries and retained artifacts. Publish the repository's manual
through [GitHub Pages](../.github/GENERATED-DOCS.md#repository-pages-manual), keeping
review artifacts separate from the durable browsing destination. Repository
adoption includes its scoped deployment setup and verification; this standard is
not a bulk settings change or evidence that existing repositories have adopted it.

## A manual owned by each repository

Apply the [documentation recipe](documentation-recipe.md) for content ownership,
navigation, version labels, and an adoption checklist. This page defines the
generation and live-verification requirements that the recipe uses.

Put a prominent **Start here: documentation** link near the top of the README,
immediately after the title or short introduction, pointing to the verified live
manual. Its landing page should explain the first useful action, provide clear
navigation and search, and link to related repositories' manuals where readers
need their concepts or tools. Link back to the source repository. Keep ownership
and version context clear rather than copying other repositories' documentation.

Generate reference content from authoritative sources: actual code and Click
help, executable feature scenarios, and relevant Task or API definitions. Retain
hand-authored explanations and first-use examples alongside those references.
Use only applicable generators: a documentation-only repository can render its
Markdown with navigation and search without adding a dummy CLI, API, or scenario
suite. Reuse the existing tooling and Task build/check commands.

Show the documented release version or identify development documentation with
its exact source revision. A moving main-branch manual must not imply it describes
every installed release. Link published version documentation when maintained;
otherwise state that historical manuals are unavailable and link the source tag.
The deployed manual is the durable reading destination, not an expiring CI
download or a promise to retain every historical build forever.

Default downloadable documentation and diagnostic artifacts to **14 days** of
retention, within provider limits; record any justified project exception. State
the retention window next to download links. This does not set a lifetime for the
deployed manual, release assets, or historical manuals. Do not infer cleanup or
deletion work from this policy; artifact retention and deployment are separate.

Documentation adoption is done when the build and applicable reference/link checks
pass, deployment succeeds for the identified revision, and the live public site
has been checked from the README link. Exercise navigation, a representative deep
link, search for a known term and opening its result, and links to related manuals.
Check that assets and search work under the repository's Pages path and that
version context is visible. Record the deployment run, source revision, live URL,
and actual results in the PR using the [review evidence template](independent-review.md#review-evidence-comment-template).
An uploaded artifact or green build alone is not verified deployment. Report
missing pages, unavailable related manuals, and blocked checks as adoption gaps;
do not publish guessed links or claim all repositories already comply.

## Safe and reproducible generation

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
The released [v5.0.0 template](https://github.com/Living-Proof-Labs/collaboration-guidelines/tree/v5.0.0/templates/generated-docs)
is an available starting point. Select a published version containing the guidance
being adopted; v5.0.0 does not contain later additions merely because the current
manual describes them. Do not invent a future version or move an existing tag.

Consumer adoption is a separate repository change: use its actual command
definitions, reviewed Taskfile, conceptual guides, and measured coverage where
available. Preserve its existing generator when suitable. Do not copy this
fixture's input contract or present the fixture as the consumer's functionality.

Primary references: [Click help](https://click.palletsprojects.com/en/stable/documentation/),
[sphinx-click](https://sphinx-click.readthedocs.io/en/stable/usage/),
[Sphinx builders](https://www.sphinx-doc.org/en/master/usage/builders/index.html),
[Task information commands](https://taskfile.dev/docs/reference/cli), and
[Coverage.py HTML](https://coverage.readthedocs.io/en/latest/commands/cmd_html.html).
