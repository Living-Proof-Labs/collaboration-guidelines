<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Shared releases

This repository versions both the working guidance and release machinery. A
consumer references one explicit version tag in its workflow; that release
contains the workflow, bundled Action, configuration, and dependency lock. A
new upstream release does not update consumers automatically. Evaluate and
update pins by PR.

Published tags are never retargeted. Record the resolved SHA in adoption PRs as
verification evidence; use the tag in the cross-repository reference. A branch
exception must document its need and exit condition. Same-repository bootstrap
paths remain tied to the running workflow's revision.

Existing third-party Actions retain reviewed full-SHA security pins here. This
is a deliberate exception for external supply-chain integrity, not the default
for Living Proof Labs cross-repository dependencies.

## Call after verification

Use the following job in a caller workflow triggered on pushes to `main`.
Select a published version tag (the example uses `v1.0.0`), and replace
`verify` with the caller's verification job for the same triggering commit. Do
not remove the consumer's verification just because the release engine is
shared.

```yaml
permissions:
  contents: read
jobs:
  # Define the repository's verify job here.
  release:
    needs: verify
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: write
    uses: Living-Proof-Labs/collaboration-guidelines/.github/workflows/semantic-release.yml@v1.0.0
```

The called job checks out the caller with full history, installs the bundled
locked toolchain, and runs semantic-release in the caller's repository.
It uses the existing caller `GITHUB_TOKEN`; no personal token or new secret is
needed. Repository and organization Actions policies must permit the call.
This implementation targets GitHub.com and Linux runners.

The shared job serializes releases within each caller repository and never
cancels an in-progress release. Keep release triggers on `main` only and wait
for verification through `needs`. A newer main commit may cause an older queued
release to skip; the next run can batch the unreleased changes.

## Contract and outputs

The workflow accepts a boolean `dry-run` input (default `false`). Dry runs
calculate version and notes without tagging or publishing, but still verify
repository access; they are not an unauthenticated PR preview mechanism.

| Output | Meaning |
| --- | --- |
| `published` | String `true` only when this invocation publishes a release |
| `version` | Published or proposed version; empty when no release is needed |
| `git-tag` | Published or proposed tag; empty when no release is needed |
| `release-url` | Published GitHub Release URL; empty for dry run or no release |

Use `needs.release.outputs.version` in downstream jobs. A failure fails the job;
it is never converted into a successful no-release outcome. A repeat run with no
new eligible commits returns `published=false`.

Only GitHub Releases are published. No npm package, generated changelog, or
version-bump commit is produced. Existing `vX.Y.Z` tags are preserved and used as
the release history; migration must retain the consumer's existing tags.

## Policy

Use Conventional Commit merge messages: `feat` is minor; `fix`, `perf`,
`docs`, `chore`, `build`, `ci`, `test`, `refactor`, `style`, and `revert`
are patch. A `!` marker or `BREAKING CHANGE:` footer is major, including for
maintenance changes. Unclassified messages follow upstream no-release behavior.
Upstream batching and revert-pair filtering are intentional.

Use a Conventional Commit squash title and retain the PR reference. Put necessary
breaking-change and migration details in the final commit body. Generated release
notes come from commits, not the complete PR discussion; keep rationale in the
linked PR rather than copying every discussion into notes.

For this repository, publication runs after verification on merged `main`.
`RELEASES_ENABLED=false` is an operational off switch. Local checks:

```sh
task setup
task verify
```

Install Task and bootstrap tools as described in the
[developer interface guide](developer-interface.md).

Tests use the real upstream engine against disposable local Git repositories.
They do not publish to GitHub. Hosted workflow checks and the first real release
are required to establish the hosted integration, especially the `$/` reference.

## Why this shape

The reusable workflow removes repeated release-job setup while leaving project
verification local. Its bundled composite Action uses `github.action_path` to
load its own locked configuration and dependencies. GitHub.com's
[self-repository action reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#example-using-an-action-in-the-same-repository-as-the-workflow-at-the-running-commit-recommended)
resolves that Action from the called workflow's exact revision. This avoids a
second pin or copying release configuration into each consumer.

A public caller needs a public source: see GitHub's
[workflow access rules](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
Changing private-action access alone does not enable public callers. Visibility
changes must be explicitly authorized; this implementation does not change them.

The versioned configuration uses the official semantic-release engine and
plugins, following the
[capability repository precedent](https://github.com/Living-Proof-Labs/robot-capability-specs/pull/3).
The small JavaScript adapter only checks the invocation and exposes engine
outputs; it does not calculate versions, generate notes, or publish itself.

## Assemble assets before immutable publication

Callers with package assets can opt into `draft-release: true`. The official
GitHub semantic-release plugin creates a draft with the calculated version,
tag and notes. `draft-created` is `true`; `published` is `false` until a public
release actually exists. Existing callers retain immediate publication by default.
Dry runs never create drafts and return both flags as `false`.

After verification, a caller may use `version` and `git-tag` to build and test
packages, upload all files and checksums to that draft, then publish it with
`gh release edit TAG --draft=false`. Use the existing repository token and keep
the final publication dependent on all package and consumption checks. A failed
build leaves a draft; do not claim it is publicly released. Recovery must reuse
and inspect the existing draft, never retarget its tag or create duplicate assets.

GitHub locks assets when an immutable release becomes public. Uploading assets
after publication fails; do not disable immutability to work around that failure.
See [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
