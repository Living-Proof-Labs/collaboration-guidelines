<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Reproducible environments and contributor commands

Prefer established command-line tools for the job: `git` for local Git work,
`gh` for GitHub, and `glab` for GitLab when available and authenticated as the
intended account. Use a connector or another authorized interface when it fits
available access. Working from the command line is a preference, not permission
to force credentials, change accounts, or bypass missing access.

## Repository convention

Every repository maintains Docker setup for a reproducible development and,
where applicable, runtime environment. Keep environment definitions in the
repository: pinned base images and tool versions, dependency locks, and
documented build targets. Docker defines the environment; Task defines project
commands. A development-container configuration reuses the same Dockerfile
target or Compose service rather than installing a second, independently
maintained toolchain.

Documentation-only repositories need a tooling environment for linting, links,
and tests. They do not need an invented application runtime or release image.
For applications, keep a lean release target separate from the development
target: share necessary base/build stages and locks, then copy only required
outputs and runtime dependencies into the release image. Keep editors, test
dependencies, and build tools in the development target unless execution
actually needs them.

Use Compose for services, mounts, working directories, and local orchestration
when needed. Keep source and dependency-volume ownership explicit so host and
container runs do not leave unusable files. A development container attaches to
that prepared environment; it is not a reason to require a nested Docker
daemon.

## Host entry points and commands inside the environment

Keep detailed ecosystem commands in one Taskfile. The existing language
templates run directly inside a prepared environment, including a development
container. A host Taskfile may delegate to Compose, which runs that same
Taskfile in the repository tooling service. Do not have an inner task call the
host wrapper again.

For this optional two-file layout, copy a language template to
`Taskfile.runtime.yml` and the [host
wrapper](../templates/container/Taskfile.yml) to `Taskfile.yml`. Here, runtime
means the environment executing the tasks, not a production application. Supply
a Compose service named `tooling` that builds the development target, mounts
the checkout, sets its working directory to the project root, and provides Task
plus the language tools. These names are example choices.

| Execution context | Setup | Verification |
| --- | --- | --- |
| Host with Docker and Compose | `task setup` | `task verify` |
| Prepared environment | See commands below | See commands below |

Inside the prepared environment or development container:

```sh
task -t Taskfile.runtime.yml setup
task -t Taskfile.runtime.yml verify
```

The host wrapper runs disposable Compose containers; persistent dependency
volumes or the mounted checkout must retain setup results between commands.
Inside the prepared environment, invoke the detailed Taskfile or its native
commands directly. Do not assume Docker-in-Docker, a mounted Docker socket, or
privileged execution. If a project needs image builds from inside a container,
document and verify that separate capability explicitly. With a single direct
Taskfile, use the ordinary `task setup` and `task verify` commands in the
prepared environment instead.

Continuous integration should use the same detailed tasks and development
images where appropriate, with provider configuration limited to orchestration.
Shared Actions or reusable workflows still handle standard services such as
releases. Test the release image separately when one exists; passing
tooling-image checks does not establish that the shipped image runs correctly.

## Bootstrap once, delegate project setup

The [shared Docker-first host](shared-host.md) provides Docker, Compose, Buildx,
Task, Git, and provider command-line clients. Repository containers supply the
language runtime, package manager, and native build tools. A directly prepared
environment still needs those project tools, but they are not common host
requirements. Environments own PATH setup; do not assume shell profiles load in
continuous integration.

Use the [official Task installation
guide](https://taskfile.dev/docs/installation). This repository uses Task
**3.54.0** and Node **24** (at least 24.10.0), with npm. For an environment
already providing npm, a pinned installation is:

```sh
npm install --prefix /your/writable/tool-directory @go-task/cli@3.54.0
```

Add that directory's `node_modules/.bin` to PATH using the environment's native
mechanism. On Windows, choose a writable Windows path. Verify `task --version`.
This is environment bootstrap, not a task that tries to install itself.

Then use the same project interface locally and in continuous integration:

| Command | Responsibility |
| --- | --- |
| `task setup` | Sync project tools/dependencies from committed locks |
| `task check` | Run native static checks without rewriting files |
| `task test` | Run the native test runner |
| `task verify` | Run check and test in sequence |

Setup should be safe to repeat: npm's clean install recreates `node_modules`;
uv's locked sync reconciles the project environment. Neither should rewrite the
lock as a side effect. A lock mismatch fails; update dependencies deliberately
with the native package manager and commit the resulting lock through a pull
request. Do not hide secrets, system installation, or security-setting changes
in setup.

## Start with the language template

Select a published version tag of this repository, then copy the relevant
Apache-2.0 Taskfile from that version into the consuming repository. Record the
source tag, retain its license notice, and adapt its native commands. These are
small starting points, not remote Taskfile dependencies or complete application
scaffolds.

- [Node/TypeScript Taskfile](../templates/node/Taskfile.yml): provide
  `package.json` and `package-lock.json`. Pin project tools in dev
  dependencies. Define `check` and `test` npm scripts using existing
  command-line tools. For TypeScript, `check` can invoke the locked `tsc
  --noEmit`; tests should use the project's actual runner. The template's `npm
  ci` permits package lifecycle scripts, which some native dependencies need.
  Use `--ignore-scripts` when the project supports it, as this repository does.
- [Python Taskfile](../templates/python/Taskfile.yml): provide `pyproject.toml`
  and `uv.lock` with Ruff and pytest in the default development group. The
  environment supplies uv and the Python version required by the project. Setup
  uses `uv sync --locked`; check/test use the installed tools without
  resyncing. Interpreter downloads are disabled so missing bootstrap tools fail
  explicitly rather than silently changing the environment.

For a new language, retain the same command names and delegate to its package
manager, formatter/linter, and test runner. Add a template when a real
repository needs it; do not reimplement those tools in Task or build a
speculative matrix. See [npm clean
installs](https://docs.npmjs.com/cli/v11/commands/npm-ci/) and [uv
locking/syncing](https://docs.astral.sh/uv/concepts/projects/sync/).

## Portability and continuous integration

Task's [schema v3](https://taskfile.dev/docs/reference/schema) provides the
common interface. Its [embedded
shell](https://taskfile.dev/docs/guide/platforms) does not make arbitrary
commands portable. Prefer native cross-platform command-line tools, Task
`dir`/`env`, and separate command entries. Avoid shell activation scripts,
Unix-only utilities, and operating-system-specific path separators in common
tasks. When an operating-system-specific command is needed, mark its
`platforms` and document the supported systems. Native dependencies can still
require platform-specific bootstrap tools.

Continuous integration runs the repository development/tooling image where
appropriate, then invokes the same setup and verification tasks. A runner that
cannot use that image must document its equivalent prepared environment and
verify the supported differences. Pinned shared Actions/reusable workflows
continue to provide standard services such as releases. Do not add a parallel
release engine to Task.

The initial templates and this repository's tasks were executed on Linux.
Windows and macOS are intended targets, not verified by that run; test them
when a consuming project claims support. Lockfiles may include
platform-specific packages even when the Taskfile commands are identical.

## Hosted development environments and verification limits

Provider configuration belongs with that provider's guidance. See [GitHub
Codespaces](../.github/DEVELOPMENT.md) and [GitLab
Workspaces](../.gitlab/DEVELOPMENT.md) for their different configuration
models. Sharing Docker definitions does not make the services interchangeable.

This repository now provides a tooling image and an optional shared host recipe.
See its [verification limits](shared-host.md#verified-scope) before claiming hosted
provider support. No GitLab workspace adoption is included.

## Tool help and generated reference

Follow [tool-first usability](tool-usability.md): help and errors should teach the
next useful action while preserving validation. The [generated documentation
fixture](../templates/generated-docs/README.md) combines actual Click definitions,
Task information, conceptual guides, and software test coverage in an HTML
artifact. Its containerized Task commands and GitHub pipeline are optional
starting points; they do not enable a public documentation site.

## Observable behavior and feature coverage

Executable behavior-driven development (BDD) feature scenarios document observable
behavior: setup, user action, and expected outcome. Adopt them incrementally for
changed features where they help describe and verify the user contract; this does
not require retrofitting every feature before a small change can proceed.
Keep scenarios in the consuming project's existing test architecture and run them
through Task and continuous integration. They should also guide an independent
reviewer's manual exploration of the installed product. Do not encode private
implementation details or create a second test framework solely for reporting.

Give features and scenarios stable names or identifiers. Link changed behavior to
its scenarios and report each scenario's passed, failed, skipped, or untested
status with the revision and CI run. Feature/scenario coverage is a traceable
inventory of specified behavior and its execution, distinct from line coverage.
State the inventory's scope and gaps; if reporting a percentage, name the
denominator. Passing every listed scenario does not prove all behavior is covered.

## Definition of done

For the development and release paths above, record evidence for each applicable
item before calling the work complete:

- Docker setup and the development container reuse the intended tooling; direct
  Task commands work inside the prepared environment without a host-wrapper loop.
- Continuous integration runs those tasks and appropriate images. An application
  release image is tested separately; documentation-only work verifies its tools.
- Tests produce individual machine-readable results, such as JUnit XML. Publish
  them to the provider's check/test interface where supported, with identifiable
  passed, failed, and skipped cases and failure details. Uploading a report file
  alone is storage, not ingestion into that interface; verify the rendered cases.
- Link the run and its test/check view from the change's verification summary.
  Include counts and report/artifact links in the run summary. Retain the raw
  machine-readable reports with a documented retention period sufficient for
  review and diagnosis, within existing provider limits. Never include secrets.
- Where executable scenarios apply, link their inventory and visible
  CI results, including gaps and skipped scenarios, separately from line coverage.
  When independently reviewing installed behavior, link the
  [review evidence](independent-review.md#definition-of-done); neither source tests
  nor coverage percentages replace that evidence.
- Generate reports and attempt summary publication, ingestion, and artifact upload
  even when tests fail. Keep the original failing test exit status and release
  gate: publisher success must never turn failed tests into passing verification.
  Missing, malformed, or incomplete reports and publishing failures are explicit
  completeness failures, not zero-test successes. Abrupt runner termination may
  prevent uploads; report that limit and retain available logs.
- Verify reporting with a passing run and a deliberately failing test in a safe
  test fixture. Confirm individual failures remain visible and the overall check
  still fails. Record unsupported provider features or restricted-fork publishing
  as explicit gaps, with the available summary and artifact evidence.

See [GitHub reporting](../.github/DEVELOPMENT.md#test-result-publication) and
[GitLab reporting](../.gitlab/DEVELOPMENT.md#test-result-publication) for ingestion
and permissions. Historical trend aggregation is a separate capability requiring
stable test identities and retained history; do not infer it from a successful
single-run upload or claim it without verifying the chosen service.

The shared-host verification workflow adopts report publication for its own
checks. Other consumers must verify their publishers separately; console output
alone does not satisfy this requirement.
