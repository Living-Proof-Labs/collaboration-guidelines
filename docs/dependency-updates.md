<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Dependency update pilot

Issue [#19](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/19)
starts with a reusable, inactive `renovate-preset.json`. This change does not
install a bot. Automerge and platform automerge are disabled. Updates are limited
to two concurrent pull requests and one per hour, before 06:00 UTC on Mondays.
Every update, including majors and pre-1.0 versions, needs review.

## Inventory and boundaries

Inspected 2026-10-26: collaboration-guidelines at released `v4.2.2`, commit
`6a031f151cb810d69eef58291213bbfc8e94a347`; robot-capability-specs at
`e1678d9e9cd8b6d1b48f694f13d1e55f2cab97d5` (latest release `v1.2.1`).
Neither checkout contains `.agents/skills`. Read the shared `AGENTS.md`,
contribution and developer-interface procedures at `v4.2.2`; the robot
repository additionally adopts `v4.1.0`.

<!-- markdownlint-disable MD013 -->

| Actual references | Handling in this slice |
| --- | --- |
| Both repositories: `.github/workflows/*.yml`, SHA-pinned third-party Actions; robot release workflow calls guidance `v2.0.3` | Native `github-actions`; preserve integrity pins |
| Both: Dockerfile Node `24.19.0-bookworm-slim` plus digest; guidance documentation image uses Python `3.12.12-slim` and uv `0.12.23` plus digests; host image uses Ubuntu `24.04` plus digest | Native `dockerfile`; native `docker-compose` for image references |
| Guidance `.github/actions/semantic-release/package.json` and lock: semantic-release `25.0.9`, plugins, lint tooling; robot root package and lock: Gherkin `42.0.1`, messages `34.2.1`, YAML `2.8.1` | Native `npm`, exact ranges, existing locks |
| Guidance `templates/generated-docs/requirements.in` and hash-locked `requirements.lock`: Click `8.3.1`, Sphinx `8.2.3`, sphinx-click `6.2.0`, coverage `7.17.0`, pytest `8.4.2` | Native `pip-compile`, explicit `.lock` file pattern; uv header identifies input and output |
| Robot `AGENTS.md` guidance `v4.1.0`; README guidance/release links `v2.0.3`; Taskfile provenance comment `v4.1.0` | Opt-in annotated fixtures only; no downstream edits or silent reconciliation of different pins |
| Robot README verifier `v1.0.1`, clone command, catalog `v1.1.0`; guidance reporter script and docs `v1.4.0` | Deferred coupled repositories; not in custom allowlist |
| Task `3.54.0` in setup Action inputs, installers, README; robot Dockerfile installer URL, checksum and command | Deferred checksum/input coupling; never update only one member |
| Guidance host `packages*.txt`, shell image strings, generated-docs installer checksum | Deferred distro-specific and checksum-coupled updates |
| Guidance adoption examples `v1.0.0`, illustrative `v1.2.3`, host/editor observations `v4.2.1` with source commits; robot `docs/adr`, `docs/issues` and version examples | Historical or illustrative text stays unchanged |

<!-- markdownlint-enable MD013 -->

No second updater configuration was found. Docker build service names and Task
schema `version: '3'` are not package pins. Node engine minimums describe supported
runtimes; they are not exact dependency releases.
Robot workflows also contain floating `actions/checkout@v4`; that existing gap
is not a strict pin and this slice does not silently convert it. SHA-pinned
Actions with major-version comments remain integrity-pinned exceptions.

## Annotation contract

Only `AGENTS.md`, `README.md`, and `docs/dependency-pins.md` accept the Markdown
marker. It must immediately precede one complete link on its own line:

```markdown
<!-- renovate: guidelines -->
[Working guidelines v4.1.0](https://github.com/Living-Proof-Labs/collaboration-guidelines/blob/v4.1.0/AGENTS.md)
```

The link label and URL are replaced together; path and fragment are retained.
The datasource is `github-releases`, matching its published-release contract.
Repeated annotated links are supported. Unannotated links, historical prose,
unrelated repositories, aliases, prereleases and non-SemVer tags are excluded.
An annotation inside a code fence is still an explicit opt-in: this is a regex
manager, not a Markdown parser. Keep teaching examples in excluded files such
as this document. Do not annotate historical examples.

The root `Taskfile.yml` accepts this variable form; commands should use the
variable rather than duplicate the version:

```yaml
vars:
  # renovate: guidelines
  GUIDELINES_VERSION: 'v4.1.0'
```

Guidance workflow calls and custom references share a package group. Adoption
must first reconcile intentionally different current versions; grouping alone
cannot prove compatibility or force different allowed ranges to the same target.

## Verification and adoption

Run `task renovate:verify` with Docker and Task installed. Run
`task renovate:extract` for a credential-free local extraction dry run. The
pinned official Renovate image supplies its runtime and validator. No host Node
or Python installation is required. Reports go to `artifacts/renovate/`.

The local platform supports extraction and lookup, not branch creation. Fixtures
and validator success are not evidence of a hosted bot pull request, refreshed
lockfiles, successful installation of proposed dependencies, or a merge gate.
A later pilot must build/test the actual proposed releases and regenerated locks.

After review and publication, consumers may extend this preset using Renovate's
`github>Living-Proof-Labs/collaboration-guidelines:renovate-preset#TAG` syntax,
replacing `TAG` with the full published release containing this file. `v4.2.2`
does not contain it. Do not adopt a branch or guessed future release. The preset
is deliberately not named `renovate.json`, so merging it does not activate
repository onboarding. Test downstream annotations in a separate reviewed PR.

Hosting and ownership remain undecided. Renovate OSS requires an operator,
compute, scheduling and approved credentials; Mend-hosted Renovate is a separate
service requiring review of current terms and repository access. Dependabot's
native managers cover several code formats but not this annotation contract.
No hosted service, App, credentials, permissions or branch protection is changed.

Pause a future installation through its approved owner, or disable the consumer
configuration in a PR. Revert a bad update/configuration through a PR, restore
known-good readable tags and locks, and rerun tests. Never move an old tag.

References: [regex managers](https://docs.renovatebot.com/modules/manager/regex/),
[validator](https://docs.renovatebot.com/config-validation/),
[local dry runs](https://docs.renovatebot.com/modules/platform/local/),
[versioned presets](https://docs.renovatebot.com/config-presets/),
[pip-compile](https://docs.renovatebot.com/modules/manager/pip-compile/).

The Python lock header uses `--output-file=requirements.lock` because Renovate
44.181.7 rejects the equivalent space-separated argument in the original header.
Only that command comment changes; locked package versions and hashes do not.
The fixture tests import the official image's extraction/replacement APIs. These
are internal APIs, deliberately tied to the pinned image; an image upgrade must
pass this suite. Tests do not reimplement a dependency resolver.

The fixture transition uses real published tags: `v4.1.0` resolves to
`e409022ccbf25419749f5c073205a3fd1afb157f`, and `v4.2.2` resolves to
`6a031f151cb810d69eef58291213bbfc8e94a347`. Both refs and the `v4.2.2` release
record were read through GitHub on 2026-10-26. This is dated provenance, not a
claim that the bot detects future tag mutation. The offline tests prove the
transition mechanically; they do not contact GitHub to rediscover these tags.
