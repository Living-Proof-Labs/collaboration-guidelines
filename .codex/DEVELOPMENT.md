<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Codex shared host configuration

Use the [common host recipe](../docs/shared-host.md). The documented
[Codex Cloud lifecycle](https://developers.openai.com/codex/cloud/environments)
currently redirects to legacy documentation; match setup and cached-resume fields
to the actual environment editor. Do not assume every Codex runtime accepts a
custom image or provides the same daemon privileges.

For a new Ubuntu 24.04 amd64 environment with an authorized root setup phase,
select the guidelines repository at the reviewed reference. Paste into setup:

```sh
bash environments/codex/setup.sh
bash environments/codex/start.sh
```

Paste into the maintenance/resume field, if provided:

```sh
bash environments/codex/start.sh
```

These commands run from the guidelines checkout. For a multi-repository workspace,
use its actual absolute checkout path in both fields; do not rely on the selected
project's current directory. Add other repositories through the existing provider
interface, keeping their project dependencies in their containers.

The owner must save the environment configuration, run its setup preview, and
inspect a successful actual container check before using the saved environment.
Setup installs missing host tools; startup requires a provider-managed Docker
daemon and fails if none is accessible. On an already-prepared non-Ubuntu host,
use only the startup check. Do not run the Ubuntu installer there.

Before the first release, select `feat/shared-docker-host` explicitly for a trial
and record its commit. After review and release, select the published version tag
containing this recipe. Setup environment variables need the provider's persistent
configuration; shell exports in a completed setup process are not persistence.
No live saved environment has been changed or fresh Codex provisioning proved by
this pull request.
