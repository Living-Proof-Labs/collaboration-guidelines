<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Living Proof Labs working guidelines

These are shared defaults for ordinary project work by people and agents.
Apply the consuming repository's explicit local additions and overrides alongside
this baseline. These instructions do not grant access or override safety controls
or higher-priority instructions.

## Move work forward

- Act within the authorized scope without repeated permission requests. Make small,
  useful changes, verify them, and iterate from what happens in practice.
- Use a pull/merge request for every project change. It is the communication
  channel and durable record: explain the problem, result, validation, and
  remaining limits.
- Human review is by exception, not a routine blocking gate. Seek it when a real
  ambiguity, material risk, or explicit requirement needs human judgment. Honor
  repository requirements and any specific hold on merging or release.
- Test and verify before merge using checks appropriate to the change. Report
  failures, skipped checks, and uncertainty truthfully; never call unrun checks
  passing. Resolve relevant failures or document the unresolved blocker.
- Keep the pull request current as scope changes. Report the delivered result
  and any work still blocked, with enough evidence for someone else to assess it.

## Write plainly

- Spell out **Living Proof Labs** in prose; do not shorten it to **LPL**.
- Prefer plain, complete words in agent-authored documentation. Do not coin
  acronyms or use unexplained shorthand; saving keystrokes is not a reason to
  make readers decode the text.
- Use established technical acronyms sparingly, only when they help the reader.
  Spell them out on first use when their meaning would otherwise be unclear.
- Preserve actual format names, commands, code identifiers, and official tool
  names. Apply this writing preference to prose, not by renaming interfaces.

## Use native tools and a consistent developer interface

- Prefer established command-line tools such as `git`, `gh`, and `glab` when
  available and authenticated for the intended account. Use authorized alternatives
  when needed; working from the command line never requires new credentials or
  bypassing access controls.
- Use Task schema v3 for common project commands: `task setup`, `task check`, and
  `task test`. Delegate to native ecosystem tools rather than reimplementing them.
- Maintain repository Docker setup for reproducible development and applicable
  runtime environments. Development containers reuse that setup; Task exposes
  contributor commands, and continuous integration reuses the tasks and images
  where appropriate. Follow the [developer interface guide](docs/developer-interface.md).
- Environments install Task and bootstrap runtimes/package managers. Task installs
  project tooling and dependencies using pinned versions and committed locks.
  Keep setup repeatable and free of secrets or system/security-setting changes.
- Continuous integration uses Task for project-specific work; shared Actions and
  reusable workflows provide standard services such as releases. Start from the
  relevant template in the [developer interface guide](docs/developer-interface.md),
  read at the same pinned revision when consuming remotely. Record actual platform
  support.

## Keep shared guidance deliberate

- Each consuming repository's `AGENTS.md` must identify an explicit published
  version tag of this baseline, plus explicit local additions and overrides.
  Use version tags for shared cross-repository guidance, templates, and workflows.
  Update deliberately through a pull request; record the resolved commit hash as
  verification evidence, not as the dependency reference. Never retarget a
  published tag.
- Branch references are rare, documented exceptions: explain the need and when
  the exception ends. Do not default to `main`, `latest`, or moving major tags.
- A Markdown link does not load instructions. Read the pinned `AGENTS.md` through
  available authorized tools before relying on it. Read any relevant referenced
  procedure at the same revision; never silently substitute `main` or latest.
- If pinned content is unavailable, report the exact reference and access failure.
  Use a locally stored copy only when it can be verified against that pin.
  Continue independent work covered by available instructions; pause decisions
  that depend on the missing guidance and request the content or access needed.
- Propose broadly useful improvements in this repository through an issue or
  pull request. Keep project-specific needs local, and name the shared rule and
  reason when overriding it.

## Release with consumers in mind

- Use semantic versioning to communicate compatibility. It protects downstream
  consumers only when they pin a version and deliberately evaluate updates.
- Prefer the existing semantic-release ecosystem. Deviate only for a demonstrated
  need, explaining the tradeoff in the pull request.
- Release from `main` after merge and verification. Documentation and maintenance
  changes are release-worthy; upstream changes may be batched.
- Put generated release notes in the hosting provider's release records.
  Do not commit generated changelogs or version-bump commits.

Contribution and release details for this repository are in
[CONTRIBUTING.md](CONTRIBUTING.md); when consuming them remotely, read that file
at the same pinned revision.

## Keep provider integration explicit

Keep general collaboration guidance and project commands provider-neutral.
GitHub is the current primary origin; early support for other providers is a
shared goal, not a claim of implemented support. Keep provider-specific settings
and service instructions in the corresponding provider directory. For GitHub,
read [.github/SETTINGS.md](.github/SETTINGS.md) at the same pinned version.
