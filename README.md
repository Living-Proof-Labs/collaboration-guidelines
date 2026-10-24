<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Living Proof Labs collaboration guidelines

A small, versioned baseline for ordinary project work. Start with
[AGENTS.md](AGENTS.md); propose improvements using
[CONTRIBUTING.md](CONTRIBUTING.md).

## Adopt in a repository

1. Choose an explicit published version tag, such as `v1.0.0`. Do not adopt an
   unreleased revision by default; wait for a release. Record the tag's resolved
   commit SHA as verification evidence.
2. Read `AGENTS.md` at that version and check it against the project's needs.
3. Add the following section to the project's root `AGENTS.md`, replacing
   `VERSION_TAG` with the selected published tag. Fill in local commands,
   additions, and any explicit overrides through a PR.
4. Confirm the agent can retrieve the repository with its existing
   authorized access. A Markdown link is a reference, not automatic loading.

```markdown
## Shared working guidelines

Read and apply the Living Proof Labs baseline at this exact revision:
https://github.com/Living-Proof-Labs/collaboration-guidelines/blob/VERSION_TAG/AGENTS.md

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

Use an explicit version tag such as `v1.2.3` (illustrative until published).
Never retarget published tags; correct mistakes in a new release. The SHA is
useful evidence to detect unexpected tag changes, not the reference itself.
Branch dependencies are rare exceptions: document the justification and the
condition for returning to a release tag. Do not default to `main`, `latest`, or
a moving major alias such as `v1`.

A checked-in copy can support offline work: record its source revision and verify
its bytes against `AGENTS.md` at that revision when adopting or updating it.
Pinning a URL alone does not make the content available offline.

## Update deliberately

Read the intervening diff and GitHub Release notes, check local overrides, and
test the consuming project's affected workflow. Open a PR changing the pin and
explaining the impact. An upstream merge or release does not update consumers.
Propose common improvements upstream through an issue or PR; retain local needs
in the consuming repository.

## Developer interface

Use [CLI-first work and Task](docs/developer-interface.md) for environment bootstrap,
common project commands, and minimal Python and Node/TypeScript templates.

## Shared release machinery and licensing

Use the [shared release workflow](docs/releases.md) after the consuming project's
verification. Pin an explicit version tag and update deliberately; versions signal
compatibility intent, while tests and review of updates establish suitability.

The [license index](LICENSE.md) scopes Apache-2.0 tooling/examples and CC BY 4.0
prose. The [licensing guide](docs/licensing.md) explains the pattern for future
repositories without changing their licenses automatically.
