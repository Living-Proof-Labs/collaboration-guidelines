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
- **Observed simulation and rendering limits:**
  - **No Docker daemon:** Containerized `task verify` wrappers, release-image
    builds, and `livingproof-verification` devcontainer runs cannot execute
    here.
  - **No `libosmesa6`:** `libEGL.so.1` is installed on the virtual machine (so
    `MUJOCO_GL=egl` tests pass), but `libosmesa6` is absent and cannot be
    installed without root. Any command that imports `mujoco` with
    `MUJOCO_GL=osmesa` (such as `livingproof-sim-mujoco`
    `tests/test_world_parity.py` or `livingproof-verification`
    `livingproof capability verify run`) fails with
    `AttributeError: 'NoneType' object has no attribute 'glGetError'` and must
    be reported as blocked rather than worked around.
  - **Direct `uv` release-wheel `HEAD` limit:** When a lockfile references a
    direct GitHub Release `.whl` URL, `uv sync --locked` issues an HTTP `HEAD`
    request that GitHub redirects (`302`) to a pre-signed `GET`-only storage
    URL, returning `401 Unauthorized`. Report that failure clearly if
    encountered rather than fabricating cache entries.
  - **Verification scope:** Direct unit, contract, lint, and Playwright
    documentation checks run in this environment establish user-space test
    behavior only; they do not substitute for container or end-to-end
    verification.

## Bootstrap the user-space environment

Run the [bootstrap script](../environments/gemini/setup.sh) from the
`collaboration-guidelines` checkout:

```sh
bash /home/antigravity/Living-Proof-Labs/collaboration-guidelines/environments/gemini/setup.sh
```

The script is idempotent and leaves `~/.bashrc` and browser NSS certificate
trust unchanged. It performs four user-space steps:

1. Writes a scoped environment file at
   `~/.local/share/living-proof/gemini-env.sh` setting `PATH`
   (`~/.local/opt/docs/bin` and `~/.local/bin`) and
   `PLAYWRIGHT_BROWSERS_PATH` (`~/.local/opt/browsers`) so tasks can source it
   explicitly:

   ```sh
   . "$HOME/.local/share/living-proof/gemini-env.sh"
   ```

2. Installs Task `3.54.0` into `~/.local/bin` after verifying the installer
   against its SHA-256 checksum.
3. Installs Python `3.10` and `3.12` through `uv python install 3.10 3.12` so
   repositories that set `UV_PYTHON_DOWNLOADS=never` or
   `--no-python-downloads` find the required interpreters locally.
4. Creates the `~/.local/opt/docs` Python virtual environment and runs
   `task setup` in `collaboration-guidelines` and
   `task -t Taskfile.runtime.yml setup` plus `playwright install chromium` in
   `robot-capability-specs` when those checkouts are present.

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
    `Resource not accessible by integration` because the integration token has
    read-only access to Organization Projects V2.

## Fresh-session-per-issue workflow

Because each Antigravity conversation starts in a fresh session without a
background timer, follow this sequence on every task:

1. **Read the issue and current PR/branch first:** Inspect the target issue,
   any linked pull request, and the repository's pinned `AGENTS.md` before
   editing files.
2. **Verify `Owner` on Project #2:** Query `Project #2` via `gh api graphql`
   and confirm the item is assigned to `Owner: Gemini` before starting work.
   Preserve any existing owner; do not reassign another agent's item.
3. **Coordinate collisions and blockers through Rivet:** If an item is
   blocked (for example by missing `libosmesa6`, Docker, or a board-write
   permission limit), leave a concise one-line blocker comment on the issue or
   pull request for Rivet.
4. **Sign every GitHub post:** Because Gemini shares the connected GitHub
   account rather than posting from a dedicated GitHub App, sign every issue
   description, pull request body, review reply, and comment with `— Gemini` as
   required by [AGENTS.md](../AGENTS.md).
5. **Report board-write limits honestly:** Never claim Project #2 status or
   owner fields were updated when `addProjectV2ItemById` or
   `updateProjectV2ItemFieldValue` fails; record the exact GraphQL error so
   Rivet or an authorized owner can update the board.
