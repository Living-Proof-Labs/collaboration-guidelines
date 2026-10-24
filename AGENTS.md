<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Living Proof Labs working guidelines

These are shared defaults for ordinary project work by people and agents.
Apply the consuming repository's explicit local additions and overrides alongside
this baseline. These instructions do not grant access or override safety controls
or higher-priority instructions.

## Move work forward

- Act within the authorized scope without repeated permission requests. Make small,
  useful changes, verify them, and iterate from what happens in practice.
- Use a pull request for every project change. It is the communication channel and
  durable record: explain the problem, result, validation, and remaining limits.
- Human review is by exception, not a routine blocking gate. Seek it when a real
  ambiguity, material risk, or explicit requirement needs human judgment. Honor
  repository requirements and any specific hold on merging or release.
- Test and verify before merge using checks appropriate to the change. Report
  failures, skipped checks, and uncertainty truthfully; never call unrun checks
  passing. Resolve relevant failures or document the unresolved blocker.
- Keep the PR current as scope changes. Report the delivered result and any work
  still blocked, with enough evidence for someone else to assess it.

## Keep shared guidance deliberate

- Each consuming repository's `AGENTS.md` must identify an explicit published
  version tag of this baseline, plus explicit local additions and overrides.
  Use version tags for shared cross-repository guidance, templates, and workflows.
  Update deliberately through a PR; record the resolved SHA as verification
  evidence, not as the dependency reference. Never retarget a published tag.
- Branch references are rare, documented exceptions: explain the need and when
  the exception ends. Do not default to `main`, `latest`, or moving major tags.
- A Markdown link does not load instructions. Read the pinned `AGENTS.md` through
  available authorized tools before relying on it. Read any relevant referenced
  procedure at the same revision; never silently substitute `main` or latest.
- If pinned content is unavailable, report the exact reference and access failure.
  Use a locally stored copy only when it can be verified against that pin.
  Continue independent work covered by available instructions; pause decisions
  that depend on the missing guidance and request the content or access needed.
- Propose broadly useful improvements in this repository through an issue or PR.
  Keep project-specific needs local, and name the shared rule and reason when
  overriding it.

## Release with consumers in mind

- Use SemVer to communicate compatibility. It protects downstream consumers only
  when they pin a version and deliberately evaluate updates.
- Prefer the existing semantic-release ecosystem. Deviate only for a demonstrated
  need, explaining the tradeoff in the PR.
- Release from `main` after merge and verification. Documentation and maintenance
  changes are release-worthy; upstream changes may be batched.
- Put generated release notes in GitHub Releases. Do not commit generated
  changelogs or version-bump commits.

Contribution and release details for this repository are in
[CONTRIBUTING.md](CONTRIBUTING.md); when consuming them remotely, read that file
at the same pinned revision.
