<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitHub repository settings

GitHub is currently the primary origin for Living Proof Labs repositories.
This guide records GitHub-specific preferences and a dated observation of
`Living-Proof-Labs/collaboration-guidelines`. It is not a settings synchronizer
or authorization to change a repository.

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
