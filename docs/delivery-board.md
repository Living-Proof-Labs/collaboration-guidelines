<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- markdownlint-configure-file { "MD013": { "tables": false } } -->

# Living Proof Labs Delivery board

The organization tracks delivery work on the
[Living Proof Labs Delivery](https://github.com/orgs/Living-Proof-Labs/projects/2)
board. The board is the shared picture of what is queued, in progress, blocked,
ready to merge, or waiting for verification after integration. This page
describes how to keep it accurate. Field and option names below match the live
board as of 14 November 2026.

## Capture every piece of work

Every piece of work has an issue, or a draft item when no repository issue
exists yet, on this board. Open a pull request only for work that already has a
board item, and link the pull request to that issue so the board's linked pull
requests field stays complete.

A dependency bump is the exception. The Renovate pull request itself is the
board item. That exception applies only to dependency bumps. When a bump
becomes engineering work, open an issue and link the pull request to it.
Triage is described in [Renovate updates](#renovate-updates).

Write the definition of done before work starts. Move an item to
**Ready to Start** only when that definition is written and agreed. Do not
start implementation from **Backlog**.

Dependency Dashboard issues stay off the board. Broader dependency automation
remains in
[#19](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/19).

## Renovate updates

The hourly board check adds each open Renovate pull request in the
organization that is missing from the board, including pull requests that were
already open. A pull request already on the board stays a single card. The
check covers every repository.

The hourly check sets Status, Owner, and Priority only when the card is first
added. After that, it keeps a Status or Owner that someone set on purpose.

| What the update needs | Status / Owner | Priority |
| --- | --- | --- |
| A version or tag change only, with every check on the exact head green or skipped | **Verifying Pull Request** / Vera | **P2**, or the priority of the item it unblocks |
| Regenerated locks or another step only engineering can run (for example the coordinated verifier and evaluator locks in [livingproof-verification](https://github.com/Living-Proof-Labs/livingproof-verification)) | **In Progress** / Rivet, with a comment saying what is missing | Same |
| Failing checks, or code changes needed (for example a major version bump such as [unitree-g1#39](https://github.com/Living-Proof-Labs/livingproof-unitree-g1/pull/39) to sim-mujoco v3) | **Blocked** / Rivet. Rivet fixes it, or opens an issue for Cody and links it | Same |
| Superseded by a newer Renovate pull request, or a duplicate | Closed with a comment, then **Done** | None |

Same means the priority in the first row. None means the item has no priority.
Closed means close the pull request with a comment, then move the card to
**Done**.

Vera's queue and blockers are set by the Owner field only. Assignees are never
used for these items. An item in **Verifying Pull Request** with Owner Vera is
her queue. The hourly check messages her about it, because changing a board
field does not wake anyone. When she passes it, Rivet merges that exact head
and the item goes straight to **Done**. A dependency bump skips a check after
the merge unless she asks for one. When she fails it, the item goes to
**Blocked** with Owner Rivet, plus a one-line comment on the pull request
saying what is blocking it and what is needed.

When the same update is open in many repositories, Rivet reviews the first one.
Once that passes, the others are checked for green checks on their exact heads
and merged together. Vera still sees each card, and she reviews the first one
in depth.

## Status

Use the board's Status field and keep it current when the work changes state.
The live options, in the board's current order, are:

- **Backlog:** The work is captured, but the definition of done is not
  yet agreed.
- **Ready to Start:** The definition of done is written. The work may
  begin.
- **In Progress:** Someone is actively doing the work.
- **In Review:** A pull request is open.
- **Verifying Pull Request:** Vera is performing independent verification.
- **Blocked:** The work cannot proceed. This is also how contributors
  (Cody, Vera, or anyone else) get the engineering lead's attention.
  Move the item to **Blocked** and leave a one-line comment on the
  issue or pull request saying what is blocking it and what is needed.
  Rivet checks **Blocked** every hour. Keep that comment current.
- **Ready To Merge:** Aaron or Keel have placed the item here as a
  handoff to the engineering lead.
- **Verifying after Merge:** The change is on `main`. Vera is
  verifying it after integration.
- **Done:** The work is finished. Done means verified after
  integration: Vera has verified the merged change on `main`.
  Docs-only or chore changes with nothing to verify may move
  straight to **Done**.

**Blocked** is a side state, not a step in the happy path. When the blocker is
cleared, move the item back to the status that matches its current work, not
automatically to **Ready To Merge**.

Revisit stale items instead of leaving an outdated status in place.

## Ready To Merge handoff

Aaron or Keel move a pull request to **Ready To Merge** when they want the
engineering lead to merge it. The engineering lead (Rivet) merges that pull
request once required checks pass on the exact head revision and verification
evidence is recorded. Required checks, branch rulesets in the organization
[`.github` repository](https://github.com/Living-Proof-Labs/.github), and
automated tests protect the merge; a human approval is not a merge gate. Honor
any explicit hold. This is the same merge rule as
[pull request 74](https://github.com/Living-Proof-Labs/collaboration-guidelines/pull/74)
in these guidelines.

Do not move an item to **Ready To Merge** while required checks are failing, the
pull request is still a draft that is waiting on other work, or independent
verification that the change requires is still outstanding.

## Verifying after Merge

After the engineering lead merges a pull request, move the item to
**Verifying after Merge**. Vera owns that post-merge verification: she
checks the change on the integrated `main` branch. Only after that
verification succeeds does the item move to **Done**.

Docs-only or chore changes with nothing to verify may skip this column
and move straight to **Done**. A dependency bump that Vera has passed also
goes straight to **Done** unless she asks for a check after the merge. See
[Renovate updates](#renovate-updates).

Post-merge checks are Light by default; see
[independent review](independent-review.md#match-verification-depth-to-risk).

## Owner and Priority

The Owner field is one accountable owner per item. The live options are Aaron,
Rivet, Cody, Vera, Art, Keel, and Gemini. Assignee can still record helpers; it
does not replace Owner. For a Renovate update, Vera's queue and a return to
Rivet are set by Owner alone. See [Renovate updates](#renovate-updates).

Priority is **P0**, **P1**, or **P2**. Aaron or Keel set it, except when the
hourly check first adds a Renovate pull request. See
[Renovate updates](#renovate-updates).

## Keep the board current

Update Status and Owner when responsibility or state changes. Name the blocker
on blocked items with a one-line comment that says what is needed, so Rivet
can act on it during the hourly **Blocked** check. Revisit items that have not
moved. Rivet runs a regular board check: check **Blocked** every hour, merge
items that sit in **Ready To Merge** when the merge rule above is met, move
merged work to **Verifying after Merge** (or straight to **Done** when there
is nothing to verify), and surface stalls, missing owners, missing priority,
and items whose status no longer matches the work. That check also adds open
Renovate pull requests that are missing from the board, and messages Vera when
an item in **Verifying Pull Request** has Owner Vera. See
[Renovate updates](#renovate-updates).
