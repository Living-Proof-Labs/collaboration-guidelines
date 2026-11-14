<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Renovate updates for the docs brand

This is the update mechanism for issue #40. The brand team's initial adoption
still owns the lock, build download, palette and render checks in each consumer.
No consumer or runner is enabled by this change.

## Recommended: an ephemeral GitHub Actions runner

Free Mend-hosted Renovate does not execute `postUpgradeTasks`. Adding the opt-in
preset there produces incomplete proposals; it is **not** a working rollout.
Keep the brand manager disabled in Mend. Run a separate, narrowly scoped Renovate
invocation on a GitHub-hosted runner using
[the reusable workflow](../../.github/workflows/docs-brand-renovate.yml).
The writer and fixture tests share the version/digest in
[`tools/renovate/image.txt`](../renovate/image.txt); update that runtime through
a reviewed tooling release. There is no persistent server. Actions runtime/quotas
and App credentials still
need an owner. This workflow is callable only; this PR activates no schedule.

The caller, reviewed on each consumer's default branch, looks like this after a
release containing this implementation exists:

```yaml
name: Docs brand updates
on:
  schedule:
    - cron: '17 * * * *'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  brand:
    uses: Living-Proof-Labs/collaboration-guidelines/.github/workflows/docs-brand-renovate.yml@vX.Y.Z
    with:
      app-client-id: ${{ vars.DOCS_BRAND_APP_CLIENT_ID }}
    secrets:
      app-private-key: ${{ secrets.DOCS_BRAND_APP_PRIVATE_KEY }}
```

Replace the version placeholder with a reviewed, published release and record
its resolved commit as adoption evidence. The workflow uses GitHub.com's
[`$/` sibling-action syntax](https://github.blog/changelog/2026-07-30-reference-same-repository-actions-with-self-repository-syntax/)
to load the runner and helper from **the exact commit of the called workflow**.
There is no consumer checkout or separately drifting helper-version input.
GitHub-hosted runners support this; self-repository references require runner
2.336.0 or newer. The updater release is independent of the proposed brand
release: new CSS is never executed as updater code. Consumer `renovate.json`
should extend only the base preset for the brand manager; do not add
`renovate-docs-brand` to free Mend. The dedicated runner loads its own opt-in
policy. Native Renovate workflow updates can keep this single tooling pin current
through normal reviewed PRs.

Bootstrap requirements:

1. Publish and review this implementation. Initial brand adoption supplies the
   existing valid root lock and checksum-enforcing build; it is still separate.
2. The owner authorizes an updater GitHub App installation on selected consumer
   repositories and stores its client ID and private key in the named Actions
   variable/secret. The App needs Contents and Pull requests **write**, Checks
   and Commit statuses **read**, plus automatic Metadata read. No Administration,
   Workflows write, Issues write, or branch-protection bypass is requested.
   The token action narrows each installation token to the caller repository
   and these permissions, then revokes it at job completion. The private key
   is available only to that trusted token action, not the Renovate container.
3. Keep provenance (`lock.mjs --check`) and rendered-manual checks in ordinary
   **read-only** PR CI with the helper independently pinned from the trusted
   tooling release. Preserve the checksum build check. Require these before
   merge through the separately authorized repository-settings process.
4. Add the caller on the default branch. Manually dispatch it there, inspect the
   first actual App-authored PR, require full CI, and then retain the schedule.
   No credential or installation has been configured by this change, and the
   live App-authenticated write path remains an acceptance test for rollout.

Trust boundaries:

- The reusable job accepts only `schedule` or `workflow_dispatch` on the caller's
  default branch. `pull_request`, `pull_request_target`, `workflow_run`, and
  dispatch on a feature branch cannot enter the secret-bearing job. Agent/bot
  authorship is not evidence that a PR is trusted. Never add a privileged
  follow-up workflow that checks out or executes a PR head or PR artifact.
- Only reviewed, pinned shared tooling runs with the installation token.
  [`runner.cjs`](runner.cjs) sets `requireConfig: ignored`, disables inherited
  configuration, and enables only this regex manager. Consumer configs cannot
  add commands, managers, registries, scripts, plugins or automerge. The helper
  and policy mounts are read-only; no Docker socket is mounted. Only one fixed
  external post-upgrade command is allowed, with shell execution disabled.
- The disposable container clones consumer content as **data**. It does not
  install consumer dependencies or run consumer tests. Proposed CSS is bytes
  to hash, never code to execute. Consumer CI runs later without the App key.
- The dedicated `renovate-docs-brand/` branch prefix and disabled Mend brand
  manager prevent two updaters from owning the same lock. This runner handles
  brand-only PRs; Mend retains workflow/preset/other dependency updates. The
  existing all-guidelines grouping applies only to the advanced unified-runner
  option below. Close any obsolete version-only brand PR before switching.
- Automerge stays off. The App token can write code and PRs, so protect its key
  and trusted default-branch workflow like other release credentials; a token
  scope is not a technical prohibition on merging. No merge operation is
  implemented. Branch rules and CI must remain effective without a bot bypass.

A dedicated App token permits ordinary PR CI to start automatically. Current
[GitHub documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
distinguishes this from `GITHUB_TOKEN`, whose automation-created PR runs require
approval. We deliberately do not use that token as the writer or silently
broaden permissions to fix unavailable CI.

## Alternatives considered

- **Ephemeral Actions Renovate runner:** reuses Renovate's release lookup, PR
  lifecycle and tested post-upgrade hook; needs App/bootstrap and Actions
  capacity, with no persistent server.
- **Privileged repair of Mend's PR:** requires base/head and artifact validation,
  race handling and protection against untrusted code execution. It adds trust
  transitions and two writers for one PR, so it is not implemented.
- **Native brand package:** could use native manifest/lock integrity on free
  Mend, but requires a new package/release/consumer contract owned with the
  brand team, beyond this update-path slice.
- **Existing trusted self-hosted Renovate:** can use the opt-in preset below
  and group brand/workflow changes where the operator already supports
  post-upgrade commands.

## Advanced: an existing trusted self-hosted Renovate runner

After this change is released, adopt that full published tag for both
`github>Living-Proof-Labs/collaboration-guidelines:renovate-preset#vX.Y.Z`
and `github>Living-Proof-Labs/collaboration-guidelines:renovate-docs-brand#vX.Y.Z`
in `extends`, in that order. Replace `vX.Y.Z` with the actual release; this is
not an existing release claim. Old preset versions cannot discover this manager.
Keep `renovate-config` and `custom.regex` in any consumer `enabledManagers`
override. The base preset discovers the root `docs-brand.lock.json` but disables
updates for its `docs-brand` dependency type until the second preset opts in.
The lock uses the field order shown in the brand README (repository immediately
before version); unrelated or nested JSON is not managed.

Before opting in:

1. The runner operator installs `tools/docs-brand/lock.mjs` from the reviewed
   released tag at `/opt/docs-brand/lock.mjs`, outside all consumer checkouts,
   read-only to Renovate. Record the resolved source commit and file checksum.
   It needs Node 24, Git, curl and public HTTPS access to `api.github.com` and
   `raw.githubusercontent.com`. No new credential is needed. Upgrade this
   trusted helper deliberately; do not execute code downloaded from a proposed
   dependency or from the consumer branch.
2. In the **global runner configuration**, narrowly allow the exact command:
   `"allowedCommands": ["^node /opt/docs-brand/lock\\.mjs --update$"]`.
   Preserve other reviewed entries. Do not allow arbitrary shell commands or
   repository scripts. This setup requires a runner supporting post-upgrade
   tasks; a repository preset cannot grant that capability. Free Mend-hosted
   Renovate does not support this
   execution path. Keep updates disabled where the command cannot be installed.
3. Add `node /opt/docs-brand/lock.mjs --check` to the consumer's existing Task
   verification path, using the same independently pinned trusted helper in CI.
   Run it against the proposed checkout and keep the existing checksum download
   and rendered-manual checks. Require those checks before merge through the
   repository's separately authorized settings process. Do not enable this
   preset until those checks are proven to fail on an inconsistent lock.
4. Ensure the existing lock passes `--check`, then adopt the opt-in preset.
   Review the first real Renovate PR and its complete rendered-manual results.
   Neither preset enables automerge; consumer overrides still need review.

## Exact behavior and failure handling

Renovate's `github-releases` datasource proposes a stable released version.
The regex manager changes only `version`. The branch-level `postUpgradeTasks`
command reads the old lock from `git show HEAD:docs-brand.lock.json` and permits
only the version to differ in the working file. It checks that the old release
still resolves to its recorded commit and that its CSS still matches sha256.
It then resolves the new published release through GitHub's commits API (which
peels annotated tags), downloads CSS by full commit, computes sha256, and checks
the tag again. Only after all checks pass does it atomically replace the lock.
Renovate includes only `docs-brand.lock.json` from this task in its commit.
The existing guidelines group keeps related workflow and documentation updates
together. The helper is idempotent when the version is unchanged.

Missing/draft/prerelease releases, moved tags, changed old checksums, malformed
locks and network failures stop regeneration. It never blesses a changed old
hash. Investigate a mismatch and restore the known-good source or review a
separate corrective lock PR. There is no checksum-bypass switch. A denied or
failed Renovate task may leave a version-only proposal; **CI must reject it**.
Do not assume task failure prevents Renovate from opening a PR.

Provenance here means consistency with GitHub's published release, resolved
commit and downloaded bytes over verified HTTPS. It is not a signature or
attestation of publisher identity. The new checksum is computed, not compared
with an independently signed digest. Upstream compromise remains a review risk.
The unchanged build checksum check still protects exact downloaded bytes.
There is a tag-movement race after verification; immutable releases plus the
consumer's later check reduce it. Public API rate limits fail closed. Private
repositories, non-root locks, arbitrary repositories/paths and prereleases are
intentionally unsupported. CSS is bounded to 1 MiB and curl does not follow
redirects. The exact five-field schema rejects extensions until reviewed.

## Mechanism choice and verification

The supported [regex manager](https://docs.renovatebot.com/modules/manager/regex/)
extracts a version; the
[GitHub tags datasource](https://docs.renovatebot.com/modules/datasource/github-tags/)
can supply a commit digest but cannot also compute a file checksum. A custom
release feed could encode both, but requires a new publisher/feed contract.
[Post-upgrade tasks](https://docs.renovatebot.com/configuration-options/#postupgradetasks)
provide the existing supported generation hook, with global command permission
and a narrow file filter. We use releases to exclude unpublished tags and verify
the release again in the helper.

`task renovate:verify` uses Renovate 44.181.7 pinned by image digest, validates
both presets and the trusted global runner configuration, and runs real
extraction/replacement into the helper, the actual
post-upgrade executor (including command denial and artifact collection), and
negative provenance fixtures. The actual production config merger is tested
against hostile consumer settings; local CLI extraction independently verifies
that only the brand lock is discovered. Local mode forcibly changes
`requireConfig` to `optional` in this pinned version, so its dry run alone cannot
prove the production trust boundary. The repository suite tests the event
guard and container/token
boundaries without real credentials. It writes individual JUnit cases and logs
to the existing
CI artifact. `task renovate:extract` performs a credential-free no-write local
extraction. Fixtures mock GitHub responses; they do not claim a live downstream
Renovate PR, hosted command permission, or downstream rendering has been proved.
