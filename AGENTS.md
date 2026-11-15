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
- Track Living Proof Labs delivery work on the organization
  [Living Proof Labs Delivery](https://github.com/orgs/Living-Proof-Labs/projects/2)
  board. Every piece of work has an issue or draft item there; pull requests
  link that issue. Write the definition of done before moving an item to Ready
  to Start, and keep Status and Owner current. After a merge, move the item
  to Verifying after Merge until Vera verifies it on the integrated main
  branch; Done means that verification is complete. Docs-only or chore
  changes with nothing to verify may go straight to Done. To get the
  engineering lead's attention, move the item to Blocked and leave a
  one-line comment on the issue or pull request saying what is blocking
  it and what is needed. See the [delivery board guide](docs/delivery-board.md).
- The engineering lead (Rivet) may merge a pull request once required checks
  pass on the exact head revision and verification evidence is recorded.
  Required checks and branch rulesets, configured as code in the organization
  [`.github` repository](https://github.com/Living-Proof-Labs/.github), and
  automated tests are what protect a merge. A human approval is not a merge
  gate. Seek human judgment when a real ambiguity, material risk, or explicit
  requirement needs it. Honor any specific hold on merging or release.
- Direction, priorities, commercial commitments, signing, purchasing, granting
  access, and unreviewed external communications stay with the organization
  owner. Those decisions are not a merge gate.
- Test and verify before merge using checks appropriate to the change. Report
  failures, skipped checks, and uncertainty truthfully; never call unrun checks
  passing. Resolve relevant failures or document the unresolved blocker. Include
  [published test-result evidence](docs/developer-interface.md#definition-of-done)
  in verification completeness.
- Keep the pull request current as scope changes. Report the delivered result
  and any work still blocked, with enough evidence for someone else to assess it.
- For independent review, use the [review guide](docs/independent-review.md) to
  inspect code and exercise the installed change and adjacent behavior in a fresh
  environment.
  Keep ordinary regression in continuous integration and findings proportionate.
- Name the verification depth (Light, Standard, or Deep) in each
  verification request so the check matches the change's risk. If none
  is named, Light is the default. See
  [match verification depth to risk](docs/independent-review.md#match-verification-depth-to-risk).
- A pull request that changes something users run, such as a quickstart, install
  documentation, or a release, needs a verification comment from the
  verification agent before merge. That agent is named in the
  [agent directory](https://github.com/Living-Proof-Labs/.github/blob/89573d88fc82ad79e2696e7cdd642444cdb99699/config/github/agents.json)
  at commit `89573d88fc82ad79e2696e7cdd642444cdb99699`. See
  [verification of user-run paths](docs/independent-review.md#verification-of-user-run-paths).
- A bot without its own GitHub account signs each GitHub post it writes (pull
  request descriptions, comments, and reviews) with its name, for example a
  final line with an em dash and the agent's name. The agents that have
  GitHub Apps are listed in the same
  [agent directory](https://github.com/Living-Proof-Labs/.github/blob/89573d88fc82ad79e2696e7cdd642444cdb99699/config/github/agents.json).

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
  runtime environments. Repositories with a development/tooling image, including
  documentation-only ones, must publish it; CI jobs must run inside it pinned by
  its multi-arch index digest (GitHub Actions `container:`), and the development
  container must reference the same image. Running outside it needs a
  documented reason in the workflow. Until a repository publishes its image, CI
  uses the documented fallback environment, and the workflow names the issue
  that tracks publishing it. Task exposes contributor commands. Follow the
  [developer interface guide](docs/developer-interface.md).
- A repository with a demo or quickstart must give a single `docker run` against
  a released image, with no install or build. The README keeps the manual setup,
  including exact runtime versions.
- Published images must be multi-arch, at least linux/amd64 and linux/arm64.
  An image that is not must say why in its release notes and README, and link
  the open issue that tracks adding the missing platforms. Version tags are
  immutable: never re-tag or overwrite one. The release job must check that the
  tag is absent before pushing (for example, `docker buildx imagetools inspect
  IMAGE:TAG` must fail) and must not push `latest` or any moving tag.
  User-facing docs and demos must reference the version tag, so Docker selects
  the host platform. Locks, CI and development containers must pin the
  multi-arch index digest, not a per-platform manifest digest.
- Renovate keeps pins (images, Actions, tool versions) current. Each repository
  must require status checks that exercise real behaviour, not only lint, on its
  branch ruleset, and those checks must be strong enough that a green run shows
  the update is safe. Test-gated automerge is the target, enabled per
  repository only with the repository owner's approval once its required
  checks are proven; until then the
  [shared dependency policy](docs/dependency-updates.md) keeps automerge off.
- Shared hosts install Docker and Task; repository containers supply language
  runtimes and package managers. Task installs
  project tooling and dependencies using pinned versions and committed locks.
  Keep setup repeatable and free of secrets or system/security-setting changes.
- Continuous integration uses Task for project-specific work; shared Actions and
  reusable workflows provide standard services such as releases. Start from the
  relevant template in the [developer interface guide](docs/developer-interface.md),
  read at the same pinned revision when consuming remotely. Record actual platform
  support.

## Make tools teach their use

- Help and errors should state expected input, explain an evidenced mistake,
  and show a useful next command and example. Keep internal diagnostics secondary
  and preserve strict validation and failure exits.
- Keep README, tool help, and generated reference pages consistent. Generate
  command reference from executable definitions; keep concepts hand-authored.
  Follow [tool usability and generated documentation](docs/tool-usability.md).
- Each repository owns a generated, publicly browsable manual with a prominent
  start-here link near the top of its README and links to related repositories'
  manuals. Use [GitHub Pages](.github/GENERATED-DOCS.md#repository-pages-manual)
  for the current GitHub origin; verify deployment and live usability before
  claiming adoption. Keep generators relevant to the repository's content.

## Keep shared guidance deliberate

- Each consuming repository's `AGENTS.md` must identify an explicit published
  version tag of this baseline, plus explicit local additions and overrides.
  Use version tags for shared cross-repository guidance, templates, and workflows.
  Update deliberately through a pull request; record the resolved commit hash as
  verification evidence, not as the dependency reference. Never retarget a
  published tag.
- Use a published tag for every pin. A pin points at that tag, and the lock
  records the tag and the commit it resolves to. Do not point a pin at a
  branch, `main`, `latest`, or a moving major tag. See
  [Integration through released tags](docs/releases.md#integration-through-released-tags).
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
- Cross-repository integration uses a released tag. The lock records the tag
  and the commit it resolves to. See
  [Integration through released tags](docs/releases.md#integration-through-released-tags).
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
