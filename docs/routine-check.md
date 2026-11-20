<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- markdownlint-configure-file { "MD013": { "tables": false } } -->

# Portable routine check

Use this runbook to resume authorized work after a restart, memory loss, or a
move to another platform. It extends the [status check](delivery-board.md#status-check)
with a dispatch, collect, and checkpoint loop. The
[delivery board guide](delivery-board.md#roles-and-queues) remains the authority
for roles, queues, ownership, and statuses; this page creates no new authority.

Whoever holds the coordinating role runs this check. That is the engineering
lead, or another coordinator, for example one that runs an assigned
lifecycle. The
coordinator manages board handoffs and never reviews its own work.

## Who fills a role

A role such as developer or verifier can be filled in two ways:

- **A persistent bot that is woken by message.** Cody and Vera run this way on
  Grok Bot today. The coordinator wakes the bot and tells it to continue its
  queue until the queue is empty.
- **A per-task worker instance.** An example is a coordinator that dispatches
  Codex workers per task. The coordinator starts or resumes the worker with the
  issue or pull request instructions and collects the result. Codex is an
  implementation worker, not a new board Owner option.

The board, the Owner field, and the handoffs are the same either way. Only the
wake and collect steps differ. Where this page says "worker", it means either.

These are operating instructions, not evidence of installed schedules, working
notifications, or active workers. A scheduled wake grants no permission. Honor
explicit holds, normal confirmations, protected settings, and deployment rules.
Keep private runtime instructions, credentials, sensitive worker identifiers,
and personal details out of repository files and public comments.

## Hourly trigger and migration

The repository routine is the single source of truth. Review and version changes
through pull requests like other repository guidance. After this page is merged
and accessible, an authorized runner can use this minimal hourly trigger:

```text
Open and execute https://github.com/Living-Proof-Labs/collaboration-guidelines/blob/main/docs/routine-check.md
Runner: <identity>; authorized scope: <scope>.
Report to: <authorized destination>; checkpoint: <durable private location>.
Honor action-specific approvals and explicit holds; the schedule grants no access.
```

This operational link deliberately follows this repository's reviewed `main`;
it is not a released dependency pin for consuming repositories. Resolve and
record the routine's commit at each wake. If it cannot be read, preserve the
last successful checkpoint and report the coverage gap instead of inventing
instructions from memory. Keep the trigger limited to the link and necessary
runner context, not a second checklist or historical task diary.

Before replacing an existing trigger, its authorized maintainer must reconcile
active historical task references into the appropriate issues and checkpoints,
including outstanding actions and wakes. Keep private identifiers private.
This documentation neither installs nor changes a live scheduler; migration
waits until the merged routine is accessible.

## Restart checklist

1. Read the repository's applicable `AGENTS.md`, the board guide, and the
   [independent review guide](independent-review.md). Read remotely adopted
   guidance at the repository's pinned version; a link does not load it.
2. Recover the latest checkpoint and read the board plus linked issue and pull
   request comments. Recover current intent, definition of done, accountable
   owner, blockers, explicit holds, exact revisions, and decisions since the
   last successful check. Current evidence takes precedence over private memory
   or a stale checkpoint. Resolve contradictory evidence before acting on it.
3. Find the existing worker through the authorized platform's worker lookup and
   private handoff record. Confirm its scope, revision, and actual state before
   resuming or replacing it. Missing private state means unknown, not idle.
4. Check for a duplicate instance. Look for recent posts on your items signed
   with your own role name under a different account. If you find any, stop
   writing on those items and follow the one-instance rule in `AGENTS.md`.
5. Select the next authorized action and record who will collect its result and
   the next wake. If no wake mechanism is available, record that gap and arrange
   an authorized manual handoff; never claim a reminder has been installed.

## Lean repository coverage

Use the [canonical repository inventory](documentation-recipe.md#organization-content-and-its-publisher)
source, `.github/config/github/repositories.json`, through authorized access;
record its resolved revision. Do not substitute a remembered repository list.
For each inventoried repository, inspect changes since its last successful
checkpoint: issues, pull requests, main-branch pipelines, skipped release jobs,
releases, and delivered evidence. Check Renovate failures and stalls using the
[dependency policy](dependency-updates.md). Read the latest organization
settings-verification report's individual results, not just its overall job
status; never apply settings during this check.

Keep this inspection read-only except for authorized reports and coordination.
Prioritize your own assigned work and assigned reviews. Respect the engineering
lead's ownership. A coordinator other than the lead routes team coordination
through the lead rather than directly dispatching another agent's roles. A
handoff to those roles below then means arranging it through the lead. Assigned
work advances under existing development/merge authority and action-specific
approvals. Pipeline success is not proof of robot capability
success: link the relevant capability results and retain missing evidence.

Deduplicate actionable findings against existing issues before reporting them.
Record per-repository coverage gaps and retry them at an explicit next check;
do not advance the last successful checkpoint past uninspected work. Preserve
successful coverage separately so an outage does not force repeated full sweeps.
Avoid repeating unchanged outage notices. Separate fleet dependency remediation,
security-audit, Health, and project-specific watches retain their own scopes and
checkpoints; this pass links their findings without taking over those watches.

## Dispatch, collect, and checkpoint

1. **Reconcile.** Work your assigned items in board priority order. Read answers
   to blockers before asking again. Preserve intentional owners and statuses;
   reuse existing cards and linked pull requests. Do not take unrelated backlog.
   Keep routine board checks lean. Fleet dependency checks, security audits, and
   project-specific watches have separate purposes and checkpoints; link their
   findings instead of silently expanding this pass into those sweeps.
2. **Prepare the handoff.** Put implementor instructions on the issue or pull
   request: scope, acceptance criteria, exact base or candidate revision,
   relevant guidance, allowed actions, evidence required, and stop conditions.
   For coding, hand off to the developer role. For review, use an independent
   reviewer. The verifier chooses the
   [verification depth](independent-review.md#match-verification-depth-to-risk);
   do not name one. A changed board field is not a dispatch.
3. **Dispatch once.** Inspect the existing worker first. Explicitly wake or
   resume the correct idle worker using an authorized channel and link the
   handoff comment. Confirm acceptance or observed activity, then checkpoint
   the worker state and next collection time. A sent message alone does not
   prove work is running. Do not start a duplicate when a worker is already
   active or when delivery is uncertain; inspect delivery and worker state
   first. Retry only after confirming the previous dispatch did not execute.
4. **Collect and act.** At the next wake, inspect results and issue/PR activity.
   Check the returned revision against the current head. Record substantive
   results on the issue/PR and act: send specific fixes back, arrange independent
   review, advance an evidenced handoff, or record a blocker. Run appropriate
   local tests before relying on hosted checks; report passed, failed, blocked,
   and not run separately. An implementor's pass is not independent review.
5. **Verify the lifecycle.** Follow the existing
   [merge handoff](delivery-board.md#ready-to-merge-handoff) and your role
   boundaries. Before any authorized merge, re-read the exact head, required
   checks, holds, and independent evidence. A new head needs an explicit review
   assessment and affected checks rerun; never bypass protections. After merge,
   record the merge revision and arrange Vera's
   [integrated-main verification](delivery-board.md#verifying-after-merge),
   using the review guide's tree comparison and CI/deployment evidence. Record
   the applicable documented exception when nothing needs post-merge checking;
   do not invent a pass or mark ordinary work Done before verification.
6. **Checkpoint and report.** Save the next action and explicit next wake before
   ending the pass, including while waiting. Put substantive evidence and
   implementor instructions on the issue/PR first, then send Aaron a concise
   chat summary linking the exact comment when something meaningful changes.
   On a routine unchanged check, update the checkpoint without repeating public
   comments or notifications. Always answer when Aaron requested the check.
   When an item finishes, hand off and continue the next authorized queue item.

### Gemini handoff

When a Gemini-owned issue has an unambiguous implementing pull request, confirm
its explicit issue link and scope against the definition of done. Move both the
issue and pull request to the board Owner for the coordinator, Status **In
Review**, reusing existing cards. That Owner is **Rivet** (the engineering
lead), or **Keel** when the item is in Keel's assigned lifecycle. Record the
linkage and arrange independent review; when Vera begins, follow the board's
**Verifying Pull Request** / Owner **Vera** handoff. Name similarity alone is
insufficient: leave ownership intact and clarify ambiguous linkage on the issue.
This does not authorize taking Gemini's unrelated backlog.

### Common outcomes

| Observed state | Action and next wake |
| --- | --- |
| Idle worker with authorized work | Resume that worker with the issue/PR instructions; confirm dispatch and record a concrete collection time. |
| Already-running worker | Reuse its reference; collect at the recorded time or completion event. Do not launch another worker. |
| Returned result | Check the revision and evidence; dispatch fixes or independent review and checkpoint the next collection. |
| Approval or decision blocked | Follow [Decisions for Aaron](delivery-board.md#decisions-for-aaron): **Blocked**, Owner **Aaron**, exact options on the issue/PR. Read replies at the next stated check; do not repeatedly ask the same question. |
| Queue exhausted | Leave idle workers alone. Checkpoint that no authorized item is ready, plus the next routine check time or explicit ready-item event and its responsible observer. |
| Failed or uncertain dispatch | Record failed/unknown, not active. Inspect delivery and existing workers before retrying; if unresolved, record the blocker, responsible owner, and next diagnostic check. |

## Personality and working style

Process lives on this page and in the board guide, and does not depend on the
platform. Each agent's personality and working style live in its Notion profile.
These links are internal. They need Living Proof Labs Notion access and will
not open for outside readers.

- [Rivet](https://app.notion.com/p/402e1aa44c29810f9255c0f8cead3aa7)
- [Cody](https://app.notion.com/p/daa01158038741c8ab8a19b5c6ac1f46)
- [Vera](https://app.notion.com/p/82d89b4c970643588db46051b25642fa)
- [Art](https://app.notion.com/p/d77b802278334a5a876bac97ae258fdb)

## Moving to another platform or account

These items do not travel in Git. Set each up again on the new account:

- The agent's GitHub App private key, saved as a bot secret.
- Its schedules and triggers, including the hourly trigger above.
- Chat or Slack installs.
- Connectors.
- Runtime memory and checkpoints. Move them through an authorized private
  channel.

Then follow these steps in order:

1. Retire the old instance's schedules and wakes first. Confirm it has made
   no recent posts under its old signature, so the old and new instances never
   run at once.
2. Set up the items above on the new account.
3. Change the signature to the new account, for example from "— Rivet (Aaron)"
   to the new account's name.
4. If the agent's identity changes, reassign the board Owner values for its
   role and its open items.
5. Confirm the new app identity can post comments and read and edit the board.
6. Recover the latest checkpoint and run the restart checklist.
7. Run a final read-only check before resuming any writes.
8. Retire the old key.

Never put secrets or private identifiers in this repository.

## Durable checkpoint template

Keep one current checkpoint per purpose in a durable, authorized store that a
successor can find from the handoff. Public issue/PR evidence carries the work;
a private companion record holds sensitive worker references. On a platform
move, transfer that record through an authorized private channel. If it cannot
be recovered, establish worker state before creating a replacement. Never store
credentials in either a repository checkpoint or a handoff comment.

```text
Purpose, authorized scope, and routine / inventory revisions:
Accountable board Owner / current Status:
Linked issue / implementing PR / latest instructions comment:
Exact base, candidate head, or merged revision (label each):
Evidence links and passed / failed / blocked / not-run results:
Worker role and state (idle / running / returned / failed / unknown):
Worker reference: public-safe description; sensitive reference stored privately
Dispatch attempt, confirmation evidence, and collector:
Last successful check (timestamp with timezone) / changes since then:
Next action and responsible actor:
Blocker or approval needed / decision comment / who can unblock:
Next wake: timestamp with timezone, or explicit event and responsible observer
Wake mechanism and confirmation, or unavailable/manual handoff needed:
```

A successor must be able to answer what to do, who is doing it, how to collect
the result, and what will trigger the next check without this conversation.
