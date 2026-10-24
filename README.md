# Living Proof Labs collaboration guidelines

A small, versioned baseline for ordinary project work. Start with
[AGENTS.md](AGENTS.md); propose improvements using
[CONTRIBUTING.md](CONTRIBUTING.md).

## Adopt in a repository

1. Choose a full commit SHA containing the guidance, or a published release tag
   that will never be moved. Before the first release, use a full commit SHA.
   The initial README-only commit is not a usable guidance pin.
2. Read `AGENTS.md` at that revision and check it against the project's needs.
3. Add the following section to the project's root `AGENTS.md`, replacing
   `FULL_40_CHARACTER_COMMIT_SHA` with the selected SHA. Fill in local commands,
   additions, and any explicit overrides through a PR.
4. Confirm the agent can retrieve the private repository with its existing
   authorized access. A Markdown link is a reference, not automatic loading.

```markdown
## Shared working guidelines

Read and apply the Living Proof Labs baseline at this exact revision:
https://github.com/Living-Proof-Labs/collaboration-guidelines/blob/FULL_40_CHARACTER_COMMIT_SHA/AGENTS.md

Use authorized tools to fetch and read that file before relying on it.
Read relevant linked procedures from the same revision.
If it cannot be read, report the exact pin and failure; do not use main or latest.
A local copy is usable only if verified against the pinned revision.
Continue independent work under available instructions, and pause decisions
that need the missing content until it or the necessary access is available.

## Local additions

- Add this repository's setup, test, and verification commands here.

## Local overrides

- None. If needed, name the shared rule, replacement, and project-specific reason.
```

For a release pin, replace the SHA path segment with the exact immutable tag,
such as `v1.2.3` (illustrative, not a claim that this release exists). Record its
resolved commit SHA too. Never use a moving branch, `latest`, or a floating major
tag such as `v1`. Published tags must not be moved.

A checked-in copy can support offline work: record its source revision and verify
its bytes against `AGENTS.md` at that revision when adopting or updating it.
Pinning a URL alone does not make the content available offline.

## Update deliberately

Read the intervening diff and GitHub Release notes, check local overrides, and
test the consuming project's affected workflow. Open a PR changing the pin and
explaining the impact. An upstream merge or release does not update consumers.
Propose common improvements upstream through an issue or PR; retain local needs
in the consuming repository.

This baseline ships without release automation. Release setup is a separate
follow-up after scope confirmation. Reusable workflows can be proposed later as
a small improvement when they reduce demonstrated duplication.
