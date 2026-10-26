<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Codex shared host configuration

Use the [common host recipe](../docs/shared-host.md). The documented
[Codex Cloud lifecycle](https://developers.openai.com/codex/cloud/environments)
currently redirects to legacy documentation; match setup and cached-resume fields
to the actual environment editor. Do not assume every Codex runtime accepts a
custom image or provides the same daemon privileges.

For an Ubuntu 24.04 or Debian 13 amd64 host with an authorized root setup phase,
select the guidelines repository at the reviewed reference. The installer detects
the operating system; no operating-system selector in the provider UI is assumed.
Paste into setup:

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
daemon and fails if none is accessible. Other already-prepared hosts can use only
the startup check. The installer adds missing tools, including `glab` and Task;
it installs Task in `/usr/local/bin`. Setup and startup include the standard
system binary directories in their process PATH. Configure `/usr/local/bin` in
the provider's persistent PATH for subsequent task shells if it is absent.

For the Debian support preview, select `fix/debian-shared-host` explicitly and
record its commit. Replace that temporary reference with the published version
containing this change after review and release; `v4.1.0` supports Ubuntu only.
Setup environment variables need the provider's persistent
configuration; shell exports in a completed setup process are not persistence.
No live saved environment has been changed or fresh Codex provisioning proved by
this pull request. No saved-environment editor/API is exposed to the validation
worker, so actual field names, root provisioning permission, and any separate
publish step must be checked in the owner's editor. Save, run the setup preview,
and publish if the editor requires it; then verify startup in a fresh task.

If the provider supplies `SSL_CERT_FILE`, the recipe passes that existing bundle
as a build secret and read-only reporter mount. `HOST_BUILD_CA_FILE` can explicitly
select another existing authorized provider bundle. Neither option installs trust
or disables TLS checks. A missing or unreadable configured file fails explicitly.
