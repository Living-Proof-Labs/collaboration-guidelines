<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Gemini Antigravity cloud environment

Google Gemini Antigravity runs commands inside a dedicated Debian 12
(`bookworm`) virtual machine as the non-root user `antigravity`
(`HOME=/home/antigravity`). Unlike the
[common Docker-first host](../docs/shared-host.md), the Antigravity sandbox
(`exebox`) does not provide root access, `sudo`, `apt-get`, or a Docker daemon.
Instead, it supplies user-space language managers and routes outbound network
and plugin traffic through a local credential-injecting proxy.

## Runtime capabilities and boundaries

- **Filesystem and persistence:** Only `/home/antigravity` and `/tmp` are
  writable; `/` is read-only. Connected Living Proof Labs repositories are
  cloned under `/home/antigravity/Living-Proof-Labs/<repo>`. The `~/.gemini`
  directory (`/shared/user/.gemini`) persists across conversations while the
  rest of the virtual machine is ephemeral.
- **Preinstalled toolchain:**
  - `/usr/bin`: `bash`, `git`, `curl`, `tmux`, `python3` (3.11), `pip`,
    `venv`, `certutil`, and `openssl`.
  - `/usr/local/bin`: `uv`, `uvx`, and Node.js 24 (`node`, `npm`, `pnpm`,
    `yarn`).
  - `/opt/antigravity/bin`: `gh` and Google Workspace command-line tools.
- **Task execution model:** Because no Docker daemon is available, follow the
  prepared-environment path in the
  [developer interface guide](../docs/developer-interface.md). Run
  `task -t Taskfile.runtime.yml setup` and
  `task -t Taskfile.runtime.yml verify` in repositories that use the two-file
  Task layout, or `task setup` and `task verify` in single-Taskfile
  repositories.

## Bootstrap the user-space environment

Run the [bootstrap script](../environments/gemini/setup.sh) from the
`collaboration-guidelines` checkout:

```sh
bash /home/antigravity/Living-Proof-Labs/collaboration-guidelines/environments/gemini/setup.sh
```

You can also save a copy at `/home/antigravity/env-setup.sh` for project-scoped
re-execution. The script is idempotent and performs seven user-space steps:

1. Removes the non-interactive early-return guard from `~/.bashrc` and appends
   `~/.local/opt/docs/bin` and `~/.local/bin` to `PATH` along with
   `PLAYWRIGHT_BROWSERS_PATH="$HOME/.local/opt/browsers"`.
2. Installs Task `3.54.0` into `~/.local/bin` after verifying the installer
   against its SHA-256 checksum.
3. Installs Python `3.10` and `3.12` through `uv python install 3.10 3.12` so
   repositories that set `UV_PYTHON_DOWNLOADS=never` or
   `--no-python-downloads` find the required interpreters locally.
4. Pre-warms the `uv` wheel cache for direct GitHub Release wheel URLs
   (`livingproof-common` and `livingproof-capability-report`). Without this
   cache entry, `uv sync --locked` sends an HTTP `HEAD` request that GitHub
   redirects (`302`) to a pre-signed `GET`-only storage URL, resulting in
   `401 Unauthorized`.
5. Creates the `~/.local/opt/docs` Python virtual environment for manual
   generation and browser tests.
6. Runs `task setup` in `collaboration-guidelines` and
   `task -t Taskfile.runtime.yml setup` plus `playwright install chromium` in
   `robot-capability-specs` when those checkouts are present.
7. Registers the preconfigured local proxy certificate authorities from
   `/etc/ssl/certs/ca-certificates.crt` and
   `/usr/local/share/ca-certificates/*.crt` into `sql:$HOME/.pki/nssdb` so
   headless Chromium trusts HTTPS requests during Playwright documentation
   tests.

## GitHub plugin and delivery board access

When the GitHub plugin is connected, the local proxy authenticates `git` and
`gh` as the signed-in user.

- **Supported operations:** Cloning, fetching, pushing branches, creating and
  updating issues and pull requests, reading repository contents via `gh api`,
  and reading the organization
  [Living Proof Labs Delivery](https://github.com/orgs/Living-Proof-Labs/projects/2)
  board (`Project #2`) by querying `organization(login: "Living-Proof-Labs")
  { projectV2(number: 2) { ... } }` via `gh api graphql`.
- **Known integration limits:**
  - `gh project list --owner Living-Proof-Labs` fails with
    `Resource not accessible by integration` when another project node in
    `organization.projectsV2.nodes` is outside the integration's scope. Query
    `projectV2(number: 2)` directly via `gh api graphql`.
  - GraphQL mutations on Organization Projects V2 (`addProjectV2ItemById`,
    `updateProjectV2ItemFieldValue`, `gh project item-add`, and
    `gh project item-edit`) fail with
    `Resource not accessible by integration` unless the Google Antigravity
    GitHub App holds organization project write permissions. When that
    permission is unavailable, report the exact GraphQL error on the issue or
    pull request so a human or authorized board agent can update the board
    fields.
  - Because Gemini shares the connected GitHub account rather than posting
    from a dedicated GitHub App, sign every issue description, pull request
    body, and comment with `— Gemini` as required by
    [AGENTS.md](../AGENTS.md).
