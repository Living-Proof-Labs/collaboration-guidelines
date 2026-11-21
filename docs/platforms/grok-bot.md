<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Setting up the team on Grok Bot

This is the Grok Bot instance of the generic
[routine check](../routine-check.md#setting-up-the-alert-on-a-new-platform).
It is the checklist a primary Grok Bot follows to set the team up on an
account. The process lives in the guidelines; this page covers only the
platform steps. Replace `<owner>` with the account owner's name.

## What does and does not transfer

Knowledge transfers through these guidelines and the Notion profiles. These do
not transfer between accounts, so set each up again: GitHub App private keys
(bot secrets), routines and triggers, connectors, Slack installs, and runtime
memory. Shared team bots transfer poorly; create ordinary bots instead.

## Copies of a role

The same role can exist under several accounts, for example "Rivet (Aaron)" and
"Rivet (Keel)". The account name in the bot name and signature marks a copy as a
known duplicate, not a compromise or impersonation. Only one copy is active at a
time. If both post at once, stop and flag the human owner.

## Create each role's bot

For each role, create a bot named `<Role> (<owner>)`, for example
"Vera (Aaron)". Set:

- a title for the role;
- a description that links the role's Notion profile and the
  [collaboration-guidelines](https://github.com/Living-Proof-Labs/collaboration-guidelines)
  repository;
- a picture.

| Role | Notion profile |
| --- | --- |
| Rivet | <https://app.notion.com/p/402e1aa44c29810f9255c0f8cead3aa7> |
| Cody | <https://app.notion.com/p/daa01158038741c8ab8a19b5c6ac1f46> |
| Vera | <https://app.notion.com/p/82d89b4c970643588db46051b25642fa> |
| Art | <https://app.notion.com/p/d77b802278334a5a876bac97ae258fdb> |

## Credentials and connectors

The account owner does these. An agent never asks for a secret in chat.

1. Add each bot's GitHub App private key as that bot's secret, named
   `<ROLE>_GITHUB_APP_PRIVATE_KEY` (for example
   `RIVET_GITHUB_APP_PRIVATE_KEY`), through the secret card.
2. Connect the GitHub, Notion, and Slack connectors the role needs.
3. Install the Slack app if Slack is used.

## Setup self-check

Each bot runs this check on first start and after any account move. It reports
every item as passed, failed, or blocked, and does not start board work until
all pass. For anything missing, it asks the account owner for exactly that step
(for example a secret card or a connector connect), then re-checks until
everything passes. It never prints a secret.

- Name includes the account owner, for example "Vera (Aaron)".
- Description links its Notion profile and the guidelines.
- Its own GitHub App key secret is present and a token can be minted.
- It can read repositories, comment, and edit the board. Do a read-only test
  first, then one harmless signed comment if allowed. Post it on the bot's own
  setup issue, or on an existing tracking issue the account owner names, never
  on another item.
- The required connectors are connected.
- Memory: runtime memory does not transfer, so on first start it re-reads the
  guidelines and its Notion profile. It records any standing rule learned since
  in the profile or the guidelines, not only in memory.
- Coordinator only: the scheduled check exists and points at the
  [routine check](../routine-check.md), and the old account's routines are
  retired.
- The signature is correct: the latest post ends with
  "— Role (account owner)", for example "— Vera (Aaron)", matching the bot name.
- No duplicate instance is posting.

## Verify before activating

For each bot, run a read-only test first: read an issue and the board, and
confirm the identity can read and comment on GitHub and can edit the board.
Post or edit only after the read-only test passes, and sign every post, for
example "— Vera (`<owner>`)".

## Schedules

- Only the coordinator, Rivet, gets the scheduled check. Its prompt is one line
  that points at the [routine check](../routine-check.md), names the role, and
  gives the signature.
- Optionally give Rivet event alerts that point at the
  [Event wakes](../routine-check.md#event-wakes-issue-or-pull-request) section.
  An issue-assigned listener per repository serves as the coordinator's issue
  fast lane. An assignment event is only a wake signal; the handler decides
  relevance by board Owner and team mentions. Split the listener into several
  routines when a platform caps the repositories per trigger (Grok Bot capped
  it at 8 in practice).
- Cody, Vera, and Art get no queue-sweep timers. The coordinator wakes them at
  each handoff and tells them to continue until their queue is empty. A role may
  keep its own narrow maintenance check, for example a weekly drift check.

## Before activating a copy

1. Retire the old account's routines and triggers first.
2. Confirm no recent posts carry the old signature, so only one instance of each
   role is active. See
   [Check for duplicate instances](../routine-check.md#check-for-duplicate-instances).
3. Update each bot's signature to the new account, and reassign board Owner
   values if an identity changed.
4. Then enable the schedule.

Never put secrets or private identifiers in this repository.
