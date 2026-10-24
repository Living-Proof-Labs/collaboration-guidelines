<!-- SPDX-License-Identifier: CC-BY-4.0 -->

<!-- markdownlint-disable-next-line MD026 -->
# Fork em all!

GitHub is the canonical product origin. Clone where convenient, contribute where
work belongs, and keep the distinction between distribution and execution clear.

## Origins, mirrors, and forks

- **Origin:** the GitHub repository owns canonical product history and releases.
- **Faithful mirror:** distributes the same canonical refs and Git objects. A
  mirror can also have explicitly downstream-only branches; those are not
  canonical product history.
- **Intentional fork:** carries deliberate changes with its own review and CI.
  Describe the divergence and send generally useful changes upstream by PR.

For example, either public endpoint provides the collaboration guide's source:

```sh
git clone https://github.com/Living-Proof-Labs/collaboration-guidelines.git
git clone https://gitlab.com/living-proof-labs/collaboration-guidelines.git
```

Choose one clone command. For an intentional fork, clone your fork and add the
GitHub canonical repository as an `upstream` remote. Check the actual remote URL;
a local remote named `origin` does not establish canonical ownership. The
[robot catalog](https://github.com/Living-Proof-Labs/robot-capability-specs) also
has a [public GitLab mirror](https://gitlab.com/living-proof-labs/robot-capability-specs).
Bitbucket clone/fork distribution is a separate useful integration; CircleCI is
a CI service, not a Git host or clone destination.

## Contributions and provider work

Use small PRs for canonical product or shared guidance changes. Keep granular
provider work in that provider's issues and merge requests, linked to a GitHub
umbrella issue so decisions and progress remain discoverable. Current umbrellas:
[GitLab #6](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/6),
[Bitbucket #7](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/7),
and [CircleCI #8](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/8).
The [GitLab work item](https://gitlab.com/living-proof-labs/collaboration-guidelines/-/work_items/1)
tracks granular GitLab work.

Develop GitLab-native CI on GitLab; do not push it to canonical GitHub merely to
wait for mirror synchronization. A provider-specific component can have its own
project and release lifecycle. Keep the [CLI-first and Task interface](developer-interface.md)
and existing path-specific licenses when contributing on any provider.

## Tags, release records, and dependencies

Canonical release tags must retain their exact Git object identity across
mirrors, including annotated tag objects and their target commits. Never move a
published tag or silently overwrite a conflicting tag: stop, report both refs,
and resolve the discrepancy explicitly without retargeting the canonical tag.
Downstream CI tags/releases must remain distinct from canonical product tags.
The exact downstream naming and publication mechanics are not yet proven; this
guide does not prescribe a universal versioning scheme.

On platforms supporting releases, tags should have release records with relevant
notes and artifacts. Git mirroring copies refs and Git objects, not provider
release objects; verify or publish those records separately through the provider's
supported process. A synchronized tag alone is not evidence of a hosted release.

Use explicit published version tags for cross-repository guidance, workflows,
and components. Before an initial component release, an explicitly documented
temporary development-branch reference is allowed: record why it is needed and
replace it with a version tag once the initial release exists. Test a component's
candidate in its own CI before consumers validate integration. Local tests,
hosted component CI, and consumer integration are separate evidence.

## Verified status on 2026-10-24

Both public GitLab pull mirrors had full canonical-ref parity verified on this
date. This is a dated source-distribution observation, not a continuous guarantee.
Both also had `provider/gitlab-ci` and `provider/gitlab-ci-pilot` branches at their
canonical source bases, with no CI implementation commits.

GitLab-hosted CI and release execution are **not yet verified**, and the account
identity gate remains unresolved. The separate
[semantic-release-ci project](https://gitlab.com/living-proof-labs/semantic-release-ci)
has a locally tested implementation that has not been published. None of these
facts establishes an end-to-end GitLab release integration.

After an origin release, compare canonical `main` and every canonical tag with
the public mirror, allowing known downstream-only branches. Record missing or
mismatched refs and check again at a reasonable interval until synchronized or
blocked. Do not force tags or repeatedly trigger mirror-update endpoints. Check
provider release records and hosted CI separately from Git ref parity.
