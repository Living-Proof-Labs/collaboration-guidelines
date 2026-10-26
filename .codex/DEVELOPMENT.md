<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Codex shared host configuration

Use the [common host recipe](../docs/shared-host.md). The documented
[Codex Cloud lifecycle](https://developers.openai.com/codex/cloud/environments)
currently redirects to legacy documentation; match setup and cached-resume fields
to the actual environment editor. Do not assume every Codex runtime accepts a
custom image or provides the same daemon privileges.

For an Ubuntu 24.04 or Debian 13 amd64 host with an authorized root setup phase,
select the guidelines repository at published tag `v4.2.1`. It resolves to commit
`12861dc824d934fbd53814f05ded85761b63c6ec`. The installer detects
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

For the existing shared configuration with a read-only Buildx home, add this
value through the provider's persistent environment configuration:

```text
BUILDX_CONFIG=/tmp/living-proof-buildx
```

Apply it to task processes, not only setup. Shell exports in a completed setup
process do not persist into later task shells. Keep an existing writable
`BUILDX_CONFIG` if one is already configured. Let the task user create its scratch
directory; do not pre-create it as root during setup. This changes Buildx state
storage, not Docker credentials or daemon configuration. See the
[shared host guidance](../docs/shared-host.md) for the ownership check.

Use `v4.2.1` for this released recipe; `v4.1.0` supports Ubuntu only. Update to
future published versions deliberately, recording the resolved commit.
No live saved environment has been changed or fresh Codex provisioning proved by
this pull request. No saved-environment editor/API is exposed to the validation
worker, so actual field names, root provisioning permission, and any separate
publish step must be checked in the owner's editor. Save, run the setup preview,
and publish if the editor requires it; then verify startup in a fresh task.

In that fresh task, without manual exports or bootstrap, verify the checkout
commit, `task --version`, `glab --version`, the persistent Buildx value and
writable state directory, then run `task host:check` and the project's container
verification. Setup must have run in an authorized root provisioning phase;
unprivileged hooks alone cannot install missing host tools. Stop at that provider
gate rather than add sudo or change security settings. Passing a manually
prepared task does not establish that the saved configuration works.

If the provider supplies `SSL_CERT_FILE`, the recipe passes that existing bundle
as a build secret and read-only reporter mount. `HOST_BUILD_CA_FILE` can explicitly
select another existing authorized provider bundle. Neither option installs trust
or disables TLS checks. A missing or unreadable configured file fails explicitly.
