<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Generated documentation artifacts

The [workflow](workflows/generated-docs.yml) builds and verifies the
[template](../templates/generated-docs/README.md) through Task. It uploads HTML and
JUnit test results for 14 days, including available diagnostics after failure.
Individual cases appear in the Actions job summary using the pinned standard
report publisher. The original test exit status remains authoritative.

This workflow uses `contents: read` only. It does not request new write permissions,
create dedicated Checks through the API, deploy Pages, or change settings.
Untrusted pull requests receive no secrets, and verification runs in a container
without network access. Image builds still require public dependency downloads;
source imports and Taskfiles must be reviewed as executable code.

Download the generated-documentation artifact from the workflow run, extract it,
and open `html/index.html`. Retained source coverage pages are intended only for
reviewable public source. Check emitted versus ingested test counts in the summary.
Local links and fragments are checked offline; external link availability is not
part of this fixture's claim. A future public deployment requires explicit scope
and separate review of permissions, source disclosure, and destination.
