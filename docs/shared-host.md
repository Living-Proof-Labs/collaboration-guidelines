<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# One Docker-first development host

Use one common host recipe for ordinary repository work across languages. The
host supplies Docker Engine, Compose, Buildx, Task, Git, GitHub CLI (`gh`), GitLab
CLI (`glab`), curl, jq, certificates, and SSH. Python, uv, ROS, Node, and project
dependencies belong in repository development containers. The host does not
need a separate language environment for each repository.

The [installer](../environments/host/install.sh) targets Ubuntu 24.04 and Debian 13 on amd64
in an already-authorized root provisioning phase. It never invokes sudo or
starts services. The [image](../environments/host/Dockerfile) uses that same
installer. Existing tools and authentication configuration are preserved;
incompatible or incomplete existing Docker installations need explicit review.
Other prepared hosts can run the checks without running the installer.

The base image digests, top-level distribution package versions, and Task archive
checksum are pinned. Each distribution supplies Docker packages; this does not add Docker's
separate package repository. Transitive packages still resolve from distribution
repositories, so this is not a byte-identical package snapshot. Retain the tested
package inventory and update pins deliberately when a package is unavailable.

## Verify and use

From this repository, with Task and an authorized Docker daemon available:

```sh
task host:check
task host:build
task host:test
task container:build
task container:test
task host:reporter
task host:evidence
```

The default host image remains Ubuntu 24.04. Set `HOST_DISTRO=debian13` for
`task host:build` to test the same installer on the pinned Debian 13 base.
The installer detects an existing host's distribution rather than using this
image-build selection. Continuous integration builds and tests both variants.

`host:check` checks tools, contacts the daemon, and executes a container.
`host:test` provisions a disposable Ubuntu image, verifies configuration survives
a repeat install, then tests container execution, Buildx, and Compose using the
existing authorized Unix socket. It does not establish that a new nested daemon
can start. It requires permission already granted to use that Docker socket.

`container:test` runs this repository's documentation and release-policy tests
inside its Node tooling image. The existing `setup`, `check`, and `test` tasks
remain direct commands for prepared Node environments. Normal shared-host users
use the container commands and do not install Node on the host.

`host:reporter` clones the published reporter
[v1.4.0](https://github.com/Living-Proof-Labs/livingproof-capability-report/tree/v1.4.0),
verifies commit `bbdc54544b900bfed9ef7e799e94f45dbe6d8df3`, builds its documented
`development` target, and executes `task setup` and `task test` inside it. The
checkout is disposable; this validation does not adopt changes in the reporter.
Its own issue tracks adoption separately.

Reports and package inventories are written under ignored `artifacts/`.
`host:evidence` records the source commit, image identifiers, Docker server
version, and GitHub run when applicable, without dumping configuration or secrets.
[GitHub verification](../.github/workflows/host.yml) publishes individual cases,
summary, and raw reports for 14 days, including after test failure. Restricted
forks retain summaries and artifacts but cannot publish write-permission Checks.
No historical trend service is implied.

If a provider already supplies `SSL_CERT_FILE`, build/test commands reuse that
existing certificate trust bundle. `HOST_BUILD_CA_FILE` takes precedence when an
explicit existing provider bundle is required. Builds receive it
as a BuildKit secret; the reporter runtime receives a read-only mount. Do not
turn off certificate verification, install new trust, or copy credentials into an image.
Unreadable configured bundles fail explicitly. A read-only
Buildx configuration directory can be avoided with `BUILDX_CONFIG` pointing to a
new writable scratch directory, without changing Docker authentication files.

## Save once per provider

Reuse this recipe and image definition across projects. Each provider still has
its own saved environment record and lifecycle; this is not a cross-provider
saved-environment service. Follow [Codex setup](../.codex/DEVELOPMENT.md) or
[Cursor setup](../.cursor/DEVELOPMENT.md), preserving existing configuration.
No script creates a saved environment, changes access, or embeds credentials.

Use a published guidelines version tag for adoption. During the Debian preview,
`fix/debian-shared-host` is an explicit temporary development reference for
review and provider trials. Replace it with the approved release containing
this change before normal adoption; `v4.1.0` supports Ubuntu only. Record the
resolved commit for each trial and never move a published tag.

## Verified scope

The development run built the host from the pinned Ubuntu base, passed four
integration cases against an existing working Docker daemon, and passed the
reporter's 30 unit tests inside its Python development image. This demonstrates
containerized project work without host Python. The tooling image also checks
report failure propagation and documentation links.

Fresh Codex saved-environment creation and fresh Cursor agent startup have not
been verified. Cursor's start hook can try its normal Docker service or default
daemon, but a provider may restrict the required runtime capabilities. Stop on
that concrete failure and retain the diagnostic; do not add privileged mode,
change socket permissions, firewall rules, storage drivers, or account settings
to force success. A working host or daemon does not prove containers can reach
package registries: build or dependency-download failure is a connectivity blocker
to diagnose and report. Any needed host firewall or network changes require
separate explicit approval; a test passing after those changes does not prove the
unchanged saved environment works. Cursor environment access and fresh-agent proof
remain separate
work, not prerequisites for reviewing the portable recipe.
