<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Contributing and releases

## Small changes, visible decisions

Open an issue for a shared need or go directly to a small PR with a concrete
improvement. Explain the problem, affected consumers, intended behavior, and
compatibility impact. Keep local exceptions in the consuming repository unless
they demonstrate a common need.

Every change goes through a PR. The engineering lead (Rivet) may merge once
required checks pass on the exact head revision and verification evidence is
recorded. Required checks, branch rulesets in the organization
[`.github` repository](https://github.com/Living-Proof-Labs/.github), and
automated tests protect a merge; a human approval is not a merge gate. Test
before merge, keep the PR's description accurate, and honor any explicit scope
or merge hold.

Track that work on the organization
[Living Proof Labs Delivery](https://github.com/orgs/Living-Proof-Labs/projects/2)
board: give it an issue or draft item, link the pull request, and keep Status
and Owner current. Aaron or Keel move a ready pull request to Ready To Merge;
the engineering lead then merges it under the rule above. After merge, the
item moves to Verifying after Merge until Vera verifies it on the integrated
main branch; only then is it Done. Docs-only or chore changes with nothing to
verify may go straight to Done. To get the engineering lead's attention, move
the item to Blocked and leave a one-line comment saying what is blocking it
and what is needed. See the
[delivery board guide](docs/delivery-board.md).

For documentation changes, check relative links, Markdown structure, and adoption
examples. Verify that pins resolve to content containing the guidance and that
examples never imply links auto-load instructions. Record what was actually
checked and any failures or unavailable checks in the PR.

## Version the shared contract

The shared contract is the behavior and procedures that consuming repositories
adopt. Assess changes from their perspective:

- **Major:** incompatible expectations or changes that require consumers to alter
  an adopted workflow.
- **Minor:** compatible new guidance or optional procedures.
- **Patch:** compatible clarifications, corrections, documentation, or maintenance.

Explain the intended impact in the PR; do not disguise a behavioral requirement
as a wording fix. Consumers remain on their selected version tag until they
update deliberately. Publish a version before cross-repository adoption. A pin
is a released tag. See
[Integration through released tags](docs/releases.md#integration-through-released-tags).

## Release from main

Prefer semantic-release and the existing ecosystem, with generated notes
published to GitHub Releases. Release only merged, verified `main` content.
Documentation and maintenance changes must be eligible for releases, and related
upstream changes may be batched into one release.

When automation is introduced, explicitly configure and test release analysis
for documentation and maintenance changes, alongside breaking changes and
features. Do not assume default release rules publish every change type. Use
commit/PR conventions consistent with the chosen configuration and verify the
calculated version and notes before activation.

Do not commit generated changelogs or version bumps. Preserve published release
tags; correct mistakes with a new release. A deviation from semantic-release
needs a concrete need and a documented tradeoff.

The [shared release implementation](docs/releases.md) implements this policy.
Release after verification on merged main; preserve existing consumer tags when
adopting it. The shared workflow/configuration is part of this repository's
versioned contract alongside the guidance.

## Keep decision history useful

Use PR discussions and GitHub Releases as the historical record. Maintain a short
rationale with source links only for constraints or tradeoffs future contributors
need to act on; update it when those facts change. A separate ADR is not required
for each change. Release notes summarize commits, so retain PR references and
necessary migration details in final merge messages.

## Existing example

The capability repository's
[v1.0.0 release implementation](https://github.com/Living-Proof-Labs/robot-capability-specs/tree/v1.0.0)
and [v1.0.0 release notes](https://github.com/Living-Proof-Labs/robot-capability-specs/releases/tag/v1.0.0)
provide an existing example: official semantic-release plugins, documentation
and maintenance patch rules, and Conventional Commit merge titles. Use this as
evidence for a later small setup change, not as a mandate to copy the whole
implementation. Upstream batching and revert filtering are acceptable.
