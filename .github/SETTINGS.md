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

# Create or correct the Pages site (GitHub Actions source) for one repository:
node tools/github/repository-settings.mjs \
  --inventory config/github/repositories.json \
  --apply --apply-pages --repo example-repository

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

### GitHub Pages

Every registered repository that publishes GitHub Pages builds it with GitHub
Actions. The policy sets `pages.build_type` to `workflow` and
`pages.https_enforced` to `true` (Enforce HTTPS). The audit below is
`tools/github/repository-settings.mjs`. It reports one of four source states,
and `--apply-pages` sends only `build_type`. It does not send
`https_enforced` or `cname`. [Apply the pinned policy](#apply-the-pinned-policy)
is the command that writes Enforce HTTPS, and only for a repository that
already has a Pages site.

`pages.https_enforced_exempt` names repositories that skip Enforce HTTPS.
Each entry has `repo` and `reason`. `repo` is a non-empty repository name,
not `owner/name`, and it cannot be repeated. `reason` is a required
non-empty string. Any other key is rejected. `website` is exempt because
its custom domain, livingprooflabs.com, is served through Cloudflare.
GitHub has no certificate for that name and returns HTTP 422 for
`https_enforced`. The recorded reason is `HTTPS terminated at Cloudflare`.

`.github` `scripts/apply-repo-policy` rejects unknown Pages keys. It must
first gain `https_enforced_exempt` support (skip `https_enforced` for listed
repos and report `exempt (<reason>)`). Only then should its pin move to the
release containing this file. `pagesHttpsEnforced` in
`tools/github/repository-settings.mjs` returns that report and
`enforce: false`, so a caller omits the write. Other Pages settings,
including `build_type`, still apply.

- `matches`: a site exists and builds from GitHub Actions. Apply writes
  nothing. This comparison does not include Enforce HTTPS.
- `drifted`: a site exists with another source, for example a legacy branch
  build. Apply sends `PUT .../pages` with only `build_type`, so the custom
  domain, HTTPS enforcement and other settings stay as they are; a changed
  custom domain fails verification.
- `missing`: `GET .../pages` is 404 **and** the repository reports
  `has_pages: false`. Apply sends `POST .../pages` with
  `build_type: workflow`.
- `inaccessible`: any other failure, including a 404 while `has_pages` is
  true or unknown, or 401/403. Apply writes nothing and reports an error,
  never a missing site.

GitHub answers 404 both when there is no site and when the caller cannot read
Pages, so a 404 alone is never treated as confirmed absence. After a write the
tool reads the site back and requires `matches`; applying again to the same
repository writes nothing (`pages=unchanged`). Pages is applied only with
`--apply --apply-pages --repo NAME`, one declared repository at a time.

Permissions: the read-only audit needs the GitHub App (or token) permission
**Pages: read**; `--apply-pages` needs **Pages: write**. Repository
administration alone does not cover the Pages endpoints. Granting the Apply App
the Pages permission is a separate access change that needs the owner's
explicit approval; until then `--apply-pages` reports `inaccessible`.
Publishing workflows deploy with their own job-scoped `pages: write` and
`id-token: write` and never receive the repository-administration credential
used by this tool.

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

## Repository policy

[`config/github/repository-policy.json`](../config/github/repository-policy.json)
is the desired GitHub state. It names no organization and no inventory.
`pages.https_enforced_exempt` names repositories that skip Enforce HTTPS,
each with a required reason. `website` is the current exception.
`schema_version` is `1`. The organization command below and
`tools/github/repository-settings.mjs` both read this declaration. The local
tool does not write Enforce HTTPS. For an exempt repository it reports
`exempt (<reason>)` and does not treat that setting as drift.

- `repository` holds REST repository settings. Wiki, discussions, and projects
  are off. Issues are on. Anyone can open a pull request. Merge commits are
  the only merge method; the commit title is the pull request title and the
  message is blank. Updating a pull request branch is suggested, auto-merge is
  allowed, and the head branch is deleted after merge.
- `graphql_repository` turns sponsorships off
  (`hasSponsorshipsEnabled: false`). That field is read and written with
  GitHub GraphQL, not the REST repository object.
- `manual_or_unavailable_settings` lists preferences the apply command does
  not write: Archive Program preservation on, Git LFS objects in source archives
  off,
  the per-push ref-update limit off, and automatic closing of linked issues
  on. The organization command names each one and skips it.
- `immutable_releases` is `true`: a published release cannot be edited. It
  does not block creating the next release. See
  [Releases and workflows](#releases-and-workflows).
- `pages.build_type` is `workflow`, so an existing site builds with GitHub
  Actions. `pages.https_enforced` is `true`, which is Enforce HTTPS on an
  existing project Pages site. A repository with no site is left alone.
  `pages.https_enforced_exempt` lists exceptions. `website` is exempt
  because HTTPS for livingprooflabs.com is terminated at Cloudflare.
  `.github` `scripts/apply-repo-policy` rejects unknown Pages keys. It must
  first gain `https_enforced_exempt` support (skip `https_enforced` for
  listed repos and report `exempt (<reason>)`). Only then should its pin
  move to the release containing this file.
- `main_ruleset` is the active default-branch ruleset in
  [Recommended main protection](#recommended-main-protection).

## Apply the pinned policy

Apply this file from a checkout of the
[Living Proof Labs `.github` repository](https://github.com/Living-Proof-Labs/.github)
with
[`scripts/apply-repo-policy`](https://github.com/Living-Proof-Labs/.github/blob/main/scripts/apply-repo-policy).
That repository pins this file by collaboration-guidelines commit and git
blob SHA in its `config/github/repository-policy.json`. The command downloads
the file from that commit over HTTPS, does not send `GH_TOKEN` for the
download, and stops if the blob SHA differs. The tag recorded in the pin is
not the fetch ref. `--policy FILE` reads a local file and does not check a
blob SHA, which is how to review an unpinned revision before the pin moves.
A normal apply uses the pin.

In that checkout, run `task setup` once before `scripts/apply-repo-policy`.
The task runs `bash tools/setup.sh` and installs the pinned Node under
`.tools`. Without that Node, `tools/with-node.sh` exits 69 and prints
`Node is not installed. Run: task setup`.

```text
scripts/apply-repo-policy (--dry-run | --apply)
    [--policy FILE] [--org ORG] [--repo NAME]
```

Help prints that synopsis on one line.

```sh
# In Living-Proof-Labs/.github, once: task setup
# Export GH_TOKEN in the environment first. Do not pass it as an argument.
scripts/apply-repo-policy --dry-run
scripts/apply-repo-policy --apply

# The same entry point through Task:
task github:policy:apply -- --dry-run
task github:policy:apply -- --apply
```

Choose exactly one of `--dry-run` or `--apply`. `--org` sets the organization
login (default `Living-Proof-Labs`). `--repo` limits the run to one repository
name, not `owner/name`.

Run the dry-run first. It prints each difference as
`setting: current -> desired`, then `outcome: not written (dry-run)`. It
performs no REST write and no GraphQL mutation. It does send read requests,
including a GraphQL query for `hasSponsorshipsEnabled`, because that value is
not on the REST repository object.

`--apply` writes only a setting whose current value differs from the policy.
A second run reports no changes when those reads match. Re-running is
idempotent. A failure to read or write one setting is reported on that
repository and the command continues with the others. The process exits 1
if any repository failed. Repositories come from
`GET /orgs/{org}/repos?type=all`. An empty list is a failure, not a clean run.

`pages.https_enforced` is sent with `PUT /repos/{owner}/{repo}/pages` only
when a Pages site already exists and the live value differs. The request body
contains only the Pages fields that differ (`https_enforced` and, when the
source also differs, `build_type`). `.github` `scripts/apply-repo-policy`
rejects unknown Pages keys. It must first gain `https_enforced_exempt`
support (skip `https_enforced` for listed repos and report
`exempt (<reason>)`). Only then should its pin move to the release containing
this file. The command does not send `cname`, does not create a Pages site,
and skips a repository with no site.
A 404 from Pages when `has_pages` is not `false` is a permission failure,
not an absent site, and that repository's Pages settings are not written.

Settings listed in `manual_or_unavailable_settings` are named and skipped.
They have no API call.

### Exit status

`scripts/apply-repo-policy` runs `tools/with-node.sh`, which starts
`tools/github/apply-repo-policy.mjs`. The command returns one of these codes.

- `0` is success. Help (`--help` or `-h`) returns 0 and does not read
  `GH_TOKEN`. A dry-run or apply returns 0 when no repository reported an
  error.
- `1` is a failed run. `GH_TOKEN` is unset, empty, or has whitespace at
  either end; at least one repository reported an error; or the program
  caught any other error that is not a usage error. A blob SHA mismatch, an
  empty organization repository list, and a policy the command rejects use
  this code.
- `64` is a usage error. Pass exactly one of `--dry-run` or `--apply`. Each
  option that takes a value needs that value. `--org` is an organization
  login. `--repo` is a repository name; `owner/name` is rejected. `--policy
  FILE` has to be readable JSON.
- `69` means the pinned Node is missing. `tools/with-node.sh` returns 69
  before Node starts. Run `task setup` in the `.github` checkout.

### Token

The token comes only from the `GH_TOKEN` environment variable. It may be a
classic personal access token, a fine-grained personal access token, or a
GitHub App installation token. The command never stores the token and never
writes it to disk, arguments, or logs.

A classic personal access token needs the `repo` scope. A fine-grained token
or GitHub App installation token needs repository permissions on the
repositories the installation can access:

- Repository settings, immutable releases, the main ruleset, and sponsorships
  require Administration: read and write.
- `pages.build_type` and `pages.https_enforced` require Pages: read and write,
  plus Administration: read and write.
- The organization repository list requires Metadata: read.

Pages is an additional permission on top of Administration. Metadata read
alone cannot change settings. GitHub Apps receive Metadata automatically.
Private repositories still have to be included in the installation. An App
manifest that requests only Administration and Metadata cannot enforce HTTPS
until the App that mints `GH_TOKEN` also has Pages: read and write. This
command does not install an App or mint a token.

If the main ruleset's bypass actors are unreadable, the ruleset is not
written.

### Repin after this file changes

After this change merges and a release is published, the `.github` repository
updates the pinned `commit` and `policy_blob_sha` in its own
`config/github/repository-policy.json`. Pin the commit that contains the
published file, not a moving branch. Until that pin moves, the command keeps
the previous policy and does not invent `pages.https_enforced`. `.github`
`scripts/apply-repo-policy` rejects unknown Pages keys. It must first gain
`https_enforced_exempt` support (skip `https_enforced` for listed repos and
report `exempt (<reason>)`). Only then should its pin move to the release
containing this file. Use `--policy FILE` for a dry-run of this revision
before the pin moves.

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
