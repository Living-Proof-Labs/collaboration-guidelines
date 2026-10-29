<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitHub repository settings

GitHub is currently the primary origin for Living Proof Labs repositories.
This guide records GitHub-specific preferences, audit evidence, and the
versioned policy at
[`config/github/repository-policy.json`](../config/github/repository-policy.json).
The
tool at `tools/github/repository-settings.mjs` is a read-only audit by default;
it is not authorization to change a repository.

## Managed defaults and change control

The policy deliberately does not list consumer repositories or hard-code an
organization. A consuming group-directory repository owns its inventory and
passes it with `--inventory`; the Node tool calls the documented GitHub REST API
through authenticated `gh`, reports drift, and is idempotent when an authorized
operator opts into application. It does not need a long-lived service, a cloud
credential, or Terraform state.

```sh
# Read-only: reports differences and makes GET requests only.
node tools/github/repository-settings.mjs --inventory config/github/repositories.json

# Test the argument safety and diff logic.
task github:settings:test

# After an authorized settings change has been approved, apply one named repo:
node tools/github/repository-settings.mjs \
  --inventory config/github/repositories.json \
  --apply --repo example-repository

# A separate, explicit approval is required before changing main protection.
node tools/github/repository-settings.mjs \
  --inventory config/github/repositories.json \
  --apply --apply-main-ruleset --repo example-repository
```

The first apply updates only one named repository in the consumer-controlled
inventory through GitHub's
repository update API and then reads it back to verify the result. It enables
immutable releases only when the dedicated endpoint positively reports that
they are disabled, and verifies that result too. The second command also creates
or updates the declared `main` ruleset and verifies the managed fields. When a
matching named ruleset has additional rules or pull-request parameters, an
update preserves those unmanaged protections rather than replacing them. Every
write target is derived from the validated inventory; the tool will not
bulk-apply, accept an undeclared repository, or write to an arbitrary endpoint.
It reports each failed operation with its repository and
reason. Its output separately labels settings, immutable releases, and the main
ruleset as applied, unchanged, unknown, or failed; an unknown immutable-release
read is never presented as a successful change. Never run either apply command
from an unreviewed workflow, fork pull request, or with a token broader than
needed.

Some owner preferences are retained in `manual_or_unavailable_settings` because
the authenticated API used by this tool does not expose a safe, documented
repository update for them: Archive Program preservation, Git LFS archive
inclusion, the ref-update limit, and automatic closing of linked issues.
Sponsorships are audited through GitHub GraphQL's
`hasSponsorshipsEnabled` field, rather than being reported as manual. Verify
the remaining controls in the Settings UI during repository creation and record
any available API support before adding it to the write path. Do not confuse
the `has_downloads` REST field with Git LFS objects in source archives.

### Recommended main protection

The declaration proposes one active branch ruleset targeted at the default
branch. It requires a pull request, blocks deletion and force-pushes, requires
the **merge** merge method, specifies zero required approving reviews, and has
no bypass actors. Consequently, people who have permission to merge can merge
their own passing pull request without a second reviewer, but nobody (including
an administrator) can directly push or force-push to `main` while the ruleset
is active. It does not require linear history, because linear history is
incompatible with the owner-selected merge-commit-only policy.

This is intentionally not a user allow-list. GitHub roles supply authorization:
only people or integrations with the required repository role can merge; the
ruleset merely ensures their change arrives through a pull request. Consumers
should use direct collaborator roles or organization teams to grant only the
needed role, and review organization base permissions separately. A `write`
role is enough to push to ordinary branches and, with a mergeable PR, merge it;
`maintain` manages repository operational settings without sensitive access
controls; `admin` can manage access and rules. Do not describe all writers as
“maintainers.”

Anyone can open a pull request against a public repository, normally from a
fork; that grants no push or merge ability. A contributor with write access may
instead use a branch in the upstream repository. Both contribution paths remain
welcome. Protecting `main` prevents malicious direct merges only when the
ruleset is active and no inappropriate bypass is granted. Review collaborator,
team, organization-base-role, and ruleset-bypass membership before enabling it.

The GitHub ruleset documentation confirms that a pull request can be required
without requiring approval, that bypasses can be scoped to roles/users/teams/
apps, and that force-push blocking is on by default. It also documents that a
linear-history rule would force squash or rebase merging, so it is omitted here:
[available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

### Releases and workflows

Release immutability is declared separately because GitHub supplies a dedicated
endpoint rather than a repository metadata field. It prevents edits to a
published release; it does not prevent the semantic-release workflow from
creating a tag and release after a merge to `main`. The existing shared release
workflow is therefore compatible, provided it retains `contents: write` only in
the trusted, post-merge release job. No tag ruleset is proposed, so release tags
remain creatable.

Merge commits are the only enabled pull-request merge method. The merge commit
title is the pull request title and its message is blank. This preserves each
branch commit and remains fully
compatible with semantic-release, which analyzes the commits reachable on
`main`; it does not require squash merges. Contributors should use meaningful,
conventional commit messages when a release should be inferred.

Fork pull-request workflows must remain untrusted: do not check out or execute
fork-controlled code in a `pull_request_target` workflow, and do not expose
write tokens or secrets to untrusted fork code. Keep the default `GITHUB_TOKEN`
read-only unless a trusted post-merge job explicitly needs a narrower elevated
permission.

## Consumer inventory

Each consumer keeps its own inventory JSON, with `schema_version`, a GitHub
owner name, and unique repository names. The tool rejects malformed names,
undeclared selected repositories, non-JSON inventories, and paths outside the
consumer's current working directory. Keep dated organization audits and access
findings with that inventory, not in this reusable policy repository.

## Explicit owner preferences

The owner specified these preferences on 2026-10-24. The repository API matched
all three when inspected that day; authenticated browser inspection confirmed
them as well.

| GitHub feature | Preferred state | Observed API value |
| --- | --- | --- |
| Wiki | Off | `has_wiki: false` |
| Issues | On | `has_issues: true` |
| Discussions | Off | `has_discussions: false` |

Keep these as GitHub-specific defaults. If another repository differs, record
the actual value separately from the desired value and obtain the appropriate
authorization before changing settings.

## Other observed choices

Observed on **2026-10-24 UTC**, through the read-only GitHub connector as
`rivet-agent-lpl`. The following are observations for this repository, not
universal requirements or inferred owner preferences.

| Setting | Observed value |
| --- | --- |
| Visibility / default branch | `public` / `main` |
| Projects / Pages | `has_projects: true` / `has_pages: false` |
| Downloads API flag | `has_downloads: false` |
| Forking / template repository | `allow_forking: true` / `is_template: false` |
| Web commit signoff required | `web_commit_signoff_required: false` |
| PR creation policy | `pull_request_creation_policy: all` |
| Squash merging | `allow_squash_merge: true` |
| Merge commits | `allow_merge_commit: true` |
| Rebase merging | `allow_rebase_merge: true` |
| Auto-merge available | `allow_auto_merge: true` |
| Delete head branches after merge | `delete_branch_on_merge: true` |
| Suggest updating PR branches | `allow_update_branch: true` |

The Downloads API flag is recorded verbatim; it does not mean GitHub Releases
are disabled. Auto-merge being available does not mean any particular PR has
auto-merge enabled.

Merge-message defaults are also observable:

| API field | Observed value |
| --- | --- |
| `squash_merge_commit_title` | `COMMIT_OR_PR_TITLE` |
| `squash_merge_commit_message` | `COMMIT_MESSAGES` |
| `merge_commit_title` | `MERGE_MESSAGE` |
| `merge_commit_message` | `PR_TITLE` |

Check the final merge message against the
[release conventions](../docs/releases.md); these defaults alone do not establish
a Conventional Commit title or preserve every migration detail.

The branch response reported `main.protected: false`. The repository ruleset
listing returned `[]`. These are the inspected responses, not a recommendation
to disable protections or a complete audit of organization policy. The
[working agreement](../AGENTS.md) still requires PRs and verification before
merge; an observed setting does not replace that agreement.

## Authenticated browser observations

A read-only browser inspection of this exact repository on **2026-10-24,
03:55–03:56 UTC** confirmed public visibility and the Wiki, Issues,
Discussions, merge-method, auto-merge, branch-update, and branch-deletion
values above. These additional observations are a dated snapshot, not newly
prescribed settings.

### General settings

Source: [General settings](https://github.com/Living-Proof-Labs/collaboration-guidelines/settings).

| Setting | Observed value |
| --- | --- |
| Release immutability | Off |
| Preserve this repository (Archive Program) | On |
| Pull requests | On |
| Sponsorships | Off |
| Issue creation | All users |
| Commit comments | On |
| Auto-close linked issues | On |
| Git LFS objects in archives | Off |
| Limit branches/tags per push | Off |

Both merge and squash default commit-message menus displayed "Default message";
the corresponding API enum values are recorded above.

The [version-tag convention](../AGENTS.md) prohibits retargeting published tags.
That working agreement is separate from GitHub's release-immutability setting,
which was off. This review did not enable it or change any setting.

### Actions settings

Source: [Actions General](https://github.com/Living-Proof-Labs/collaboration-guidelines/settings/actions).

| Setting | Observed value |
| --- | --- |
| Allowed actions | All actions and reusable workflows |
| Require full-length commit-SHA action pins | Unchecked |
| Artifact and log retention | 90 days |
| Cache retention | 7 days |
| Cache eviction limit | 10 GB |
| Fork PR workflow approval | First-time contributors require approval |
| Default workflow token | Read repository contents and packages |
| Read-and-write default token option | Unselected and disabled |
| Actions may create and approve pull requests | Unchecked and disabled |

The selected fork-approval option was "Require approval for first-time
contributors." The default token selection is distinct from explicit permissions
in the [release workflow](workflows/semantic-release.yml). The unchecked SHA-pin
setting does not change the reviewed third-party Action pins in that workflow.
Disabled controls are recorded without attributing a cause.

### Runners and Actions policies

- [Runners](https://github.com/Living-Proof-Labs/collaboration-guidelines/settings/actions/runners):
  no self-hosted runners configured. This does not imply GitHub-hosted runners
  are unavailable.
- [Actions Policies](https://github.com/Living-Proof-Labs/collaboration-guidelines/settings/actions/rules):
  no policies created. This is a distinct settings page from repository rulesets.

## Evidence and inspection limits

Read-only sources used for this observation:

- [Repository metadata](https://api.github.com/repos/Living-Proof-Labs/collaboration-guidelines)
- [Main branch](https://api.github.com/repos/Living-Proof-Labs/collaboration-guidelines/branches/main)
- [Repository rulesets](https://api.github.com/repos/Living-Proof-Labs/collaboration-guidelines/rulesets)

These endpoints show current state when revisited, not a historical snapshot.
This document and its PR record the dated observation. GitHub documents the
[repository fields](https://docs.github.com/en/rest/repos/repos#get-a-repository)
and [ruleset listing](https://docs.github.com/en/rest/repos/rules#get-all-repository-rulesets).

The connector rejected `GET /repos/{owner}/{repo}/actions/permissions` as an
unsupported fetch endpoint (HTTP 400); it did not return a settings value.
The authenticated browser observations above supply the bounded Actions,
runner, and policy findings. Settings pages may require authenticated access
and, like the API endpoints, display current rather than historical state.
Broader security and organization settings are outside this bounded review,
not an unfinished audit commitment. No secrets were accessed and no repository
settings were changed. Speculative future UI notices are not recorded as policy.

When refreshing this guide, record the date, repository, exact field/value, and
source. Separate observed state, explicit preferences, and unknown values.
Do not treat an unavailable field as off or an API default as an observed choice.

## Supporting other providers

Keep project commands, dependency versions, and collaboration expectations in
provider-neutral files. Provider settings and CI/service integration belong in
the provider's own location, as this GitHub guide and workflows do in `.github`.

| GitHub concept | Equivalent concept to evaluate on another provider |
| --- | --- |
| Pull requests | Merge requests or a reviewable change proposal |
| Issues | Project issue/ticket tracking |
| Wiki / Discussions | Optional knowledge and discussion features |
| Branch automation | Source-branch cleanup, update, and automatic merge |
| Actions and reusable workflows | Provider CI and reusable service integration |
| Releases and version tags | Versioned release records, notes, and Git tags |
| Branch protection / rulesets | Provider branch and repository policies |

Early, frequent support for other providers is an explicit goal. Preserve the
same Task interface and version-tagged contracts, then verify the provider's
actual capabilities and behavior in a real integration. These conceptual
mappings are not evidence that another provider is implemented or tested.
Add provider-specific guidance when there is a real use case; do not create
empty adapters or speculative CI implementations.
