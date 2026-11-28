<!-- SPDX-License-Identifier: Apache-2.0 -->

# Shared releases

This repository versions both the working guidance and release machinery. A
consumer references one explicit version tag in its workflow; that release
contains the workflow, bundled Action, configuration, and dependency lock. A
new upstream release does not update consumers automatically. Evaluate and
update pins by PR.

Published tags are never retargeted. Record the resolved SHA in adoption PRs as
verification evidence; use the tag in the cross-repository reference.

A version tag is the preferred way to identify a commit. Published tags are
never retargeted, so a tag alone names one commit. Wherever a release is named
or checked (pins, contract results, run manifests, reports, and docs), use the
tag. A recorded commit hash is evidence that can still show that a tag was
retargeted, not a second identity that consumers compare. For Living Proof Labs
releases, use a commit hash only for a commit that has no tag, such as a pull
request head under verification (see the third-party Actions exception below).

Same-repository bootstrap paths remain tied to the running workflow's revision.
Cross-repository integration is specified in
[Integration through released tags](#integration-through-released-tags).

Existing third-party Actions retain reviewed full-SHA security pins here. This
is a deliberate exception for external supply-chain integrity, not the default
for Living Proof Labs cross-repository dependencies.

## Integration through released tags

A repository depends on another repository through a released tag. The lock
records that tag and the commit the tag resolves to. Where the dependency is a
container image, the lock also records the image digest. Pins never point at
branches, pull requests, or unreleased commits. Artifacts from a branch, a
pull request, or an unreleased commit are cleaned up, so a run that passes
today can stop working later.

The component repositories are the robots, the evaluators, the verifier, and
the reporter. There are no preview runs of unreleased commits, and there are no
reports on pull requests in those repositories. Each repository's pull request
tests that repository's own contract. The author, a person or an agent, covers
every contract the change touches with that repository's tests.

Integration runs in the downstream repository's pin pull request when the pin
moves to a tag that already exists. For robot reports, that pull request is in
[livingproof-verification](https://github.com/Living-Proof-Labs/livingproof-verification).
capability-verifier's pin of livingproof-evaluator-scenario is another
downstream pin, and it moves in capability-verifier. Renovate opens the pull
request, or a developer opens it on purpose, knowing the downstream effect. A
breaking change that has merged in an upstream repository reaches a downstream
repository when the downstream pin moves. A follow-up pin pull request is the
designed way to bring that release in, and the pull request traces to a tag
that already exists.

For example, a verifier release reaches the robot reports when a pull request
in livingproof-verification moves the verifier pin to that released tag. The
pull request run stores the report as a GitHub Actions artifact. After the pull
request merges, the report is published on GitHub Pages. Public reports never
show fixture or mock runs.

Those component repositories cut releases with the shared
[semantic-release workflow](../.github/workflows/semantic-release.yml)
in this repository. Every commit uses a type from the [Policy](#policy)
list, because the release is cut from the commits.

Aaron set this rule on 2026-11-13. The design discussion is
[livingproof-verification issue 40](https://github.com/Living-Proof-Labs/livingproof-verification/issues/40).

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

Release-first is the organization rule: verification gates `release`, `release`
tags `main` first, and every job that builds, packages, or deploys a versioned
artifact on `main` depends on `release` (`needs: release`) and receives its
`version`, `git-tag`, and `commit` outputs. Do not build or seal a versioned
release artifact on `main` from a pre-release forecast before the tag exists.

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
| `commit` | Exact source commit evaluated |
| `release-url` | Published GitHub Release URL; empty for dry run or no release |

A writer failure fails the job. It is never converted into a successful
no-release outcome. The notes-push recovery below is a publication of the
release that the writer had already tagged, not an empty success. A repeat
run that finds that Release already present returns `published=false`.

The writer pushes the version tag, then `refs/notes/semantic-release-vX.Y.Z`,
and only then creates the GitHub Release. GitHub can reject that notes ref
with a bare `(failed)` and no rule name. The tag is already on the remote,
and the Release does not exist. A later run sees the tag and reports that
there are no relevant changes, so those commits never appear in a Release.
Earlier notes refs on the same repositories show that the rejection is
transient rather than a standing permission or ruleset failure.

After that notes push fails, the action retries the same notes ref three
times, waiting 1 second, then 2 seconds, then 4 seconds. The retry is not a
force push and does not push any tag. The Release is still created when
every notes attempt fails, because the interrupted writer never reached
publication. A retry that succeeds also continues to publication for the
same reason. Creation uses `gh release create --verify-tag` with notes
generated from the previous stable tag by the same notes generator the
writer uses. `--verify-tag` does not create or move a tag. When the caller
set `draft-release`, the recovered Release is a draft, so the caller can
still attach assets before publication.

The same creation runs on a later invocation when the evaluated commit
already has a stable tag that peels to exactly that commit and that tag has
no GitHub Release. `published`, `draft-created`, `version`, `git-tag`, and
`release-url` describe the Release created by that recovery. A tag that
peels to any other commit is refused, and every existing tag is left
untouched. A Release that already exists, whether draft or published, is
not created again and is not edited; this invocation reports no new
publication.

`expected-version` and `expected-commit` are deprecated legacy inputs from the
retired pre-release sealed-artifact design. Do not use them in new or updated
workflows; run `release` before any versioned build or deployment instead. When
retained by an older pinned caller, supplying both binds the writer (and bare-tag
recovery) to that exact version and commit, while supplying only one is an
error.

Only GitHub Releases are published. No npm package, generated changelog, or
version-bump commit is produced. Existing `vX.Y.Z` tags are preserved and used as
the release history; migration must retain the consumer's existing tags.

## Resolve build versions without publishing

Use the [read-only version workflow](../.github/workflows/semantic-release-candidate.yml)
for pull requests to `main` (and explicit `workflow_dispatch` `replay-tag`
delivery retries). On normal `main` pushes, do not resolve a separate forecast
before `release`: run `release` after verification and pass its `version`,
`git-tag`, and `commit` outputs to downstream build and deployment jobs.

### Pull requests

Use `semver-version` to build and label pull request artifacts.
The format is `BASE-pr.PR_NUMBER.RUN_NUMBER.ATTEMPT`, such as
`9.8.0-pr.131.42.1`.
The base is the forecast (`version`), or when no release is due, the next patch
above the latest stable release on the event base (or `1.0.0` before the first
release).
This fallback does not schedule a release or fill in the forecast outputs.
No pull request creates a tag, release, or production deployment.

Each new run of the same caller workflow gets a higher numeric run number, and
each rerun of the same GitHub Actions run gets a higher attempt number, so each
pull request build receives a unique version.
A newer pull request event can see a newly released main base and recalculate
the forecast, even if its head has not yet incorporated that base. Older
events use their own exact base, not moving main. For example,
`9.8.0-pr.131.42.1` precedes `9.8.0-pr.131.43.1`, which precedes
`9.9.0-pr.131.44.1` if the forecast rises. This is not a guarantee that the
version core cannot fall if release intent or policy changes.

Use one caller workflow for each artifact family. Record the exact commit,
run identifier, and attempt in artifact provenance, and use the output
appropriate to the artifact without rebuilding the version in the caller:

- `semver-version` is the canonical branch build version, for example
  `9.8.0-pr.131.42.1`.
- `pep440-version` is `BASE.devN` for Python. The numeric identifier `N`
  concatenates the caller workflow run number, repository-unique run ID,
  and attempt, with the last two numbers zero-padded to 20 digits. This stays
  ordered within a workflow and prevents collisions between workflows in the
  same repository without depending on an undocumented order for run IDs.
  Separate repositories do not share a version namespace.
- `debian-version` is `BASE~pr.PR_NUMBER.RUN_NUMBER.ATTEMPT` for Debian
  package control metadata. Apply any Debian package revision separately.
  This does not change numeric versions in robot package manifests.

### Replay and publication

The resolver returns `commit`, `run-id`, and `run-attempt`. Before building on a
pull request or retry, verify those against the current checkout and attempt.
GitHub can retain successful jobs on a failed-job-only rerun; if a build job's
version input is from an earlier attempt, rerun all jobs instead of reusing that
identity. A failed release or plan is not a fallback.

For an explicit main delivery retry, a publisher can pass `replay-tag`
on a manual run. This read-only gate requires the tag's exact commit to
match current main and the checked-out source, plus an existing published
stable release. It supplies the same three plain versions without invoking
the writer. A bare tag (including one left by a failed writer), draft, or
wrong commit does not qualify. Publication still independently verifies
the tag and artifact and only uses the artifact from that attempt.
Keep the build path and its chosen version output the same in all lanes.

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

This repository opts into draft creation. Its tooling publisher first checks
that the release is still a draft, publishes the tested `amd64` and `arm64`
images and their index, validates the index, and uploads `tooling-index.json`
and `tooling-image.json`. Only a successful upload permits final publication.
A registry, validation, upload, or finalization failure fails the job and leaves
the release unpublished unless publication itself completed. Inspect the remote
state before recovery: existing image tags are never overwritten, including
partial publications. Historical immutable releases are not repaired or retagged.

GitHub locks assets when an immutable release becomes public. Uploading assets
after publication fails; do not disable immutability to work around that failure.
See [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

## Container distribution

Use a public container registry, such as GitHub Container Registry, for routine
release images. Before removing an image archive from a consumer's future release
assets, independently verify that the same image, version, and supported platform
can be pulled anonymously by immutable registry digest and run successfully.
Inspect the installed package version, entrypoint, and required dependencies in
the delivered image. If the registry replacement fails or is unavailable, retain
the working download route and report the gap. This procedure grants no new
registry credentials or permissions.

Keep short-lived internal image archives when jobs need to transfer the exact
built and tested image, including untrusted pull-request previews. Normally retain
candidate artifacts for 14 days. Preserve build-once/test/publish behavior and fork
safety. Candidate retention does not authorize deletion of supported registry
manifests or layers referenced by pinned releases.

Consumer release workflows should select public assets explicitly and test both
that image archives are excluded and that required non-image assets remain.
Preserve wheels, Debian packages, source archives, reports, checksums, and useful
provenance. A filename ending in `.tar.gz` may be a source package; do not exclude
archives solely by suffix. The shared release Action does not select or upload
consumer assets, so this selection belongs in each consumer's workflow.

Release notes must name each registry image, its multi-arch index digest, and
supported platforms, with copyable pull/run commands for that product. A local
Docker image ID is not a registry manifest digest. Verify registry consumption
before final release publication and retain granular evidence identifying the
commit, CI-built artifact, digest, platform, commands, and results. Follow the
[independent review procedure](independent-review.md) and verify the delivered
release after merge.

Explicit offline or air-gapped exports remain an opt-in use case. Changes to
future asset selection leave existing release assets and registry images intact.
Historical cleanup requires a separate inventory, reference/dependency protection,
and explicit approval; it is not part of this distribution change.

## Deliver this repository’s manual

A normal push to main runs verification, then runs the release writer to tag
main and create a draft release. Downstream of `release`, the manual build uses
the release outputs to build, test, and package the manual, while tooling
publication completes its draft, image, evidence, and finalization sequence.
Only then does Pages deploy the manual for that exact immutable published
release, after an authenticated current-main check. Pull requests to main use
`semantic-release-candidate.yml` for unique versioned manual artifacts and
cannot deploy.

The **Guidelines release** workflow retains its existing no-input manual recovery
for the release and tooling. It does not deploy Pages. If a Pages artifact has
expired, run **Repository manual** on main with an explicit `replay_tag` for the
existing immutable stable release at current main. This route rebuilds and tests
only the manual, and cannot create a tag, publish a release, or push an image.
