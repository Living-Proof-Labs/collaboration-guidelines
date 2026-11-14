<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Living Proof Labs Delivery board

The organization tracks delivery work on the
[Living Proof Labs Delivery](https://github.com/orgs/Living-Proof-Labs/projects/2)
board. The board is the shared picture of what is queued, in progress, blocked,
or ready to merge. This page describes how to keep it accurate. Field and
option names below match the live board as of 14 November 2026.

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
- **Blocked:** The work cannot proceed. State the blocker in a comment
  on the issue or item, and keep that comment current.
- **Ready To Merge:** Aaron or Keel have placed the item here as a
  handoff to the engineering lead.
- **Done:** The work is finished.

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

## Owner and Priority

The Owner field is one accountable owner per item. The live options are Aaron,
Rivet, Cody, Vera, Art, and Keel. Assignee can still record helpers; it does
not replace Owner.

Priority is **P0**, **P1**, or **P2**. Aaron or Keel set it.

## Keep the board current

Update Status and Owner when responsibility or state changes. Name the blocker
on blocked items. Revisit items that have not moved. Rivet runs a regular board
check: merge items that sit in **Ready To Merge** when the merge rule above is
met, and surface stalls, missing owners, missing priority, and items whose
status no longer matches the work.
