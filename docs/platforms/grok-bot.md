<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Setting up the team on Grok Bot

This is the Grok Bot instance of the generic
[routine check](../routine-check.md#setting-up-the-alert-on-a-new-platform).
It is the checklist a primary Grok Bot follows to set the team up on an
account. The process lives in the guidelines; this page covers only the
platform steps. Replace `<owner>` with the account owner's name.

<!-- markdownlint-disable-next-line MD013 -->
Setup prompt: `Follow https://docs.livingprooflabs.com/collaboration-guidelines/docs/platforms/grok-bot.html; the owner is <owner>.`

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

The primary bot creates the role bots itself using its `create-agent` tool.
For each role, create a bot named `<Role> (<owner>)`, for example
"Vera (Aaron)". Set:

- a title for the role;
- a description that links the role's Notion profile and the
  [collaboration-guidelines](https://github.com/Living-Proof-Labs/collaboration-guidelines)
  repository;
- a picture: the role's Twemoji emoji from the role table below, on a
  transparent background, as a 512 by 512 pixel PNG, with no background shape
  or colour.

Get the emoji from Twemoji at
`https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/<code>.svg`,
using the code in the table. Each role keeps the same emoji on every account,
so copies are recognizable. The emoji matches the role's Notion page icon and
GitHub App avatar. A green dot on the bot's icon shows that it is working, and
a blue dot at the end of the bot's name shows that a message is waiting; both
still show with a custom picture.

| Role | Notion profile | Emoji (Twemoji code) |
| --- | --- | --- |
| Rivet | <https://app.notion.com/p/402e1aa44c29810f9255c0f8cead3aa7> | 🔩 (`1f529`) |
| Cody | <https://app.notion.com/p/daa01158038741c8ab8a19b5c6ac1f46> | 👨‍💻 (`1f468-200d-1f4bb`) |
| Vera | <https://app.notion.com/p/82d89b4c970643588db46051b25642fa> | ✅ (`2705`) |
| Art | <https://app.notion.com/p/d77b802278334a5a876bac97ae258fdb> | 🎨 (`1f3a8`) |

## GitHub Apps

Each role has its own GitHub App. These identifiers are public, not secrets.
The private key is the secret; see the next section.

| Role | App slug | App ID | Client ID |
| --- | --- | --- | --- |
| Rivet | `rivet-agent-living-proof-labs` | 5723603 | `Iv23liSnZp6IPzMoiAou` |
| Cody | `cody-agent-living-proof-labs` | 5754786 | `Iv23li9RBeg0uN451sRK` |
| Vera | `vera-agent-living-proof-labs` | 5754857 | `Iv23liYBxxux5KQGYEc2` |
| Art | `art-agent-living-proof-labs` | 5754862 | `Iv23liwA0BHXfMGWqk7M` |

## Credentials and connectors

The account owner does these, and Rivet is the only role that asks the owner
(see [Rivet speaks for the account owner](#rivet-speaks-for-the-account-owner)).
Cody, Vera, and Art ask Rivet, who gets the owner to do the step. An agent never
asks for a secret in chat.

1. Add each bot's GitHub App private key as that bot's secret, named
   `<ROLE>_GITHUB_APP_PRIVATE_KEY` (for example
   `RIVET_GITHUB_APP_PRIVATE_KEY`), through the secret card. The card may
   store the key on one line, with line breaks turned into spaces. Tooling must
   rebuild the PEM line breaks before signing; otherwise the JSON web token
   fails with "A JSON web token could not be decoded".
   The App ID and Client ID are public and listed in the
   [GitHub Apps table](#github-apps), so the owner need not supply them. Nor
   does the owner need to supply the installation ID: once the token works, the
   bot finds it with `GET /app/installations`.
2. Connect the GitHub, Notion, and Slack connectors the role needs.
3. Install the Slack app if Slack is used.

## Setup self-check

Each bot runs this check on first start and after any account move. It reports
every item as passed, failed, or blocked, and does not start board work until
all pass. For anything missing, Rivet asks the account owner for exactly that
step (for example a secret card or a connector connect). Cody, Vera, and Art ask
Rivet for it, and Rivet gets the owner to do it. Each bot then re-checks until
everything passes. It never prints a secret.

- Name includes the account owner, for example "Vera (Aaron)".
- Description links its Notion profile and the guidelines.
- Its own GitHub App key secret is present and a token can be minted. Verify
  the key by minting an installation token, and compare the key's SHA256
  fingerprint with the one on the app's Key pairs page.
- It can read repositories, comment, and edit the board. Do a read-only test
  first, then one harmless signed comment if allowed. Post it on the bot's own
  setup issue, or on an existing tracking issue the account owner names to
  Rivet, never on another item.
- The required connectors are connected.
- Memory: runtime memory does not transfer, so on first start it re-reads the
  guidelines and its Notion profile. It records any standing rule learned since
  in the profile or the guidelines, not only in memory.
- Coordinator only: the scheduled check exists and points at the
  [routine check](../routine-check.md), and the old account's routines are
  retired.
- The signature is correct: the latest post ends with
  "— Role (account owner)", for example "— Vera (Aaron)", matching the bot name.
  A bot's first start, with no prior posts, counts as a pass.
- No duplicate instance is posting.
- Messaging works: the bot sends a short message to each other role bot and
  gets a reply from each. Report which roles answered.

## Verify before activating

For each bot, run a read-only test first: read an issue and the board, and
confirm the identity can read and comment on GitHub and can edit the board.
Post or edit only after the read-only test passes, and sign every post, for
example "— Vera (`<owner>`)".

## Rivet speaks for the account owner

**Rivet is the route to the account owner.** The owner does not take requests
from the other role bots. Cody, Vera, and Art put any question, approval, or
blocker on the board as **Blocked** with Owner Rivet and a one-line comment,
then wake Rivet by agent-to-agent message. Rivet decides what it may decide, and
takes the rest to the owner as
[Decisions for Aaron](../delivery-board.md#decisions-for-aaron) describes.
Rivet also gets the owner to do steps only the owner can do, such as secret
cards and connectors. A direct answer or instruction from the owner in a role
bot's own chat still applies and always wins.

Rivet holds full authorization from the account owner (for example Aaron or
Keel). When Rivet asks another role bot (Cody, Vera, or Art) to do something,
the request carries the authority the account owner has recorded for Rivet.
Work goes through Rivet so it gets done efficiently. A role bot acts on Rivet's
request without asking the owner to confirm again, including setting its
picture. Rivet records decisions that matter on the board or the pull request,
signed. The owner can still override or stop Rivet directly. This does not widen
what any bot may do under the guidelines. Secrets never go in chat, and adding
or widening repository, organization, or app permissions and access still need
the owner to do the step, which Rivet asks for.

Agent-to-agent messaging was tested on 2026-11-23. Each bot confirmed its own
exchanges with the other bots that day.

## Schedules

- Only the coordinator, Rivet, gets the scheduled check. Create Rivet's routines
  paused. They may be created before the old copies are retired, for example
  when the owner asks for them to exist disabled. Enable them only after every
  self-check item passes, including the duplicate-instance check, and the old
  copies are confirmed quiet. Its prompt is the runbook link plus role and
  signature, in the exact shape given in
  [Setting up the alert on a new platform](../routine-check.md#setting-up-the-alert-on-a-new-platform).
- Optionally give Rivet event alerts whose prompt points at the
  [Event wakes](../routine-check.md#event-wakes-issue-or-pull-request) section,
  in the same shape. Each run ends with a brief summary of the actions taken to
  the runner's report destination.
- Anything that needs someone's answer or decision, human or agent, goes on the
  board as **Blocked** with that person as Owner, plus a comment saying exactly
  what they need to answer. Do not use a chat message or a report for decisions
  (priority wake messages between bots are still fine).
- An issue-assigned listener per repository serves as the coordinator's issue
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
4. Enable Rivet's paused routines only after every bot's self-check passes and
   the old copies are confirmed quiet.

At the end of setup, the primary bot reports one summary per bot, covering what
passed, what is blocked, and what the owner still needs to do.

Never put secrets or private identifiers in this repository.
