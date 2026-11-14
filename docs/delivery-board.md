<!-- SPDX-License-Identifier: CC-BY-4.0 -->

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

Write the definition of done before work starts. Move an item to
**Ready to Start** only when that definition is written and agreed. Do not
start implementation from **Backlog**.

Renovate dependency pull requests, dependency dashboards, and other automated
dependency noise stay off the board.

## Status

Use the board's Status field and keep it current when the work changes state.
The live options, in the board's current order, are:

- **Backlog:** The work is captured, but the definition of done is not
  yet agreed.
- **Ready to Start:** The definition of done is written. The work may
  begin.
- **In Progress:** Someone is actively doing the work.
- **In Review:** A pull request is open.
- **Verifying:** Vera is performing independent verification.
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
and move straight to **Done**.

Post-merge checks are Light by default; see
[independent review](independent-review.md#match-verification-depth-to-risk).

## Owner and Priority

The Owner field is one accountable owner per item. The live options are Aaron,
Rivet, Cody, Vera, Art, and Keel. Assignee can still record helpers; it does
not replace Owner.

Priority is **P0**, **P1**, or **P2**. Aaron or Keel set it.

## Keep the board current

Update Status and Owner when responsibility or state changes. Name the blocker
on blocked items with a one-line comment that says what is needed, so Rivet
can act on it during the hourly **Blocked** check. Revisit items that have not
moved. Rivet runs a regular board check: check **Blocked** every hour, merge
items that sit in **Ready To Merge** when the merge rule above is met, move
merged work to **Verifying after Merge** (or straight to **Done** when there
is nothing to verify), and surface stalls, missing owners, missing priority,
and items whose status no longer matches the work.
