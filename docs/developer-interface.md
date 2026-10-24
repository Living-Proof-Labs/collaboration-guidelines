<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# CLI-first work and Task

Prefer established CLIs for the job: `git` for local Git work, `gh` for GitHub,
and `glab` for GitLab when available and authenticated as the intended account.
Use a connector or another authorized interface when it fits available access.
CLI-first is a preference, not permission to force credentials, change accounts,
or bypass missing access.

## Bootstrap once, delegate project setup

Environments provide Task plus the project's bootstrap prerequisites: its
language runtime and package manager, and any required native build tools.
Record supported versions and install through official or verified package
channels. Environments own PATH setup; do not assume shell profiles load in CI.

Use the [official Task installation guide](https://taskfile.dev/docs/installation).
This repository uses Task **3.54.0** and Node **24** (at least 24.10.0), with npm.
For an environment already providing npm, a pinned installation is:

```sh
npm install --prefix /your/writable/tool-directory @go-task/cli@3.54.0
```

Add that directory's `node_modules/.bin` to PATH using the environment's native
mechanism. On Windows, choose a writable Windows path. Verify `task --version`.
This is environment bootstrap, not a task that tries to install itself.

Then use the same project interface locally and in CI:

| Command | Responsibility |
| --- | --- |
| `task setup` | Sync project tools/dependencies from committed locks |
| `task check` | Run native static checks without rewriting files |
| `task test` | Run the native test runner |
| `task verify` | Run check and test in sequence |

Setup should be safe to repeat: npm's clean install recreates `node_modules`;
uv's locked sync reconciles the project environment. Neither should rewrite the
lock as a side effect. A lock mismatch fails; update dependencies deliberately
with the native package manager and commit the resulting lock through a PR.
Do not hide secrets, system installation, or security-setting changes in setup.

## Start with the language template

Select a published version tag of this repository, then copy the relevant
Apache-2.0 Taskfile from that version into the consuming repository. Record
the source tag, retain its license notice, and adapt its native commands.
These are small starting points, not remote Taskfile dependencies or complete
application scaffolds.

- [Node/TypeScript Taskfile](../templates/node/Taskfile.yml): provide `package.json`
  and `package-lock.json`. Pin project tools in dev dependencies. Define `check`
  and `test` npm scripts using existing CLIs. For TypeScript, `check` can invoke
  the locked `tsc --noEmit`; tests should use the project's actual runner.
  The template's `npm ci` permits package lifecycle scripts, which some native
  dependencies need. Use `--ignore-scripts` when the project supports it, as this
  repository does.
- [Python Taskfile](../templates/python/Taskfile.yml): provide `pyproject.toml`
  and `uv.lock` with Ruff and pytest in the default development group. The
  environment supplies uv and the Python version required by the project.
  Setup uses `uv sync --locked`; check/test use the installed tools without
  resyncing. Interpreter downloads are disabled so missing bootstrap tools fail
  explicitly rather than silently changing the environment.

For a new language, retain the same command names and delegate to its package
manager, formatter/linter, and test runner. Add a template when a real repository
needs it; do not reimplement those tools in Task or build a speculative matrix.
See [npm clean installs](https://docs.npmjs.com/cli/v11/commands/npm-ci/) and
[uv locking/syncing](https://docs.astral.sh/uv/concepts/projects/sync/).

## Portability and CI

Task's [schema v3](https://taskfile.dev/docs/reference/schema) provides the common
interface. Its [embedded shell](https://taskfile.dev/docs/guide/platforms) does not
make arbitrary commands portable. Prefer native cross-platform CLIs, Task
`dir`/`env`, and separate command entries. Avoid shell activation scripts,
Unix-only utilities, and OS-specific path separators in common tasks. When an
OS-specific command is needed, mark its `platforms` and document the supported
systems. Native dependencies can still require platform-specific bootstrap tools.

CI installs Task and bootstrap tools, then invokes `task setup` and
`task verify` for project-specific work. Pinned shared Actions/reusable workflows
continue to provide standard services such as releases. Do not add a parallel
release engine to Task.

The initial templates and this repository's tasks were executed on Linux.
Windows and macOS are intended targets, not verified by that run; test them when
a consuming project claims support. Lockfiles may include platform-specific
packages even when the Taskfile commands are identical.
