<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Renovate updates for the docs brand

This is the update mechanism for issue #40. The brand team's initial adoption
still owns the lock, build download, palette and render checks in each consumer.
No consumer or runner is enabled by this change.

## Bootstrap once, update through pull requests thereafter

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
   tasks; a repository preset cannot grant that capability. Hosted plans may
   not support it. Keep updates disabled where the command cannot be installed.
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
both presets, and runs real extraction/replacement into the helper, the actual
post-upgrade executor (including command denial and artifact collection), and
negative provenance fixtures. It writes individual JUnit cases and logs to the existing
CI artifact. `task renovate:extract` performs a credential-free no-write local
extraction. Fixtures mock GitHub responses; they do not claim a live downstream
Renovate PR, hosted command permission, or downstream rendering has been proved.
