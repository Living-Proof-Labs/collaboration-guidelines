<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Cursor shared host configuration

Use the [common host recipe](../docs/shared-host.md) with Cursor's
[cloud environment setup](https://cursor.com/docs/cloud-agent/setup). Select the
repositories needed for normal work in one saved multi-repository environment;
this is one shared host definition, not a Python or ROS environment per project.
Cursor still resolves saved environments by repository or repository group.

For a single-repository trial using guidelines as the configuration root, merge
the [example](../environments/cursor/environment.json.example) into
`.cursor/environment.json` without overwriting existing settings:

```json
{
  "build": {
    "dockerfile": "../environments/host/Dockerfile",
    "context": ".."
  },
  "install": "bash environments/cursor/install.sh",
  "start": "bash environments/cursor/start.sh"
}
```

Dockerfile and context paths are relative to the repository's `.cursor` directory.
For a saved multi-repository environment, select the same Dockerfile/build context
from the guidelines checkout, and set install/start working paths to that checkout
using its actual absolute path. Repository `.cursor/environment.json` fallback
applies to single-repository runs; do not assume it configures a saved group.

The owner must create/save the environment in Cursor's dashboard, build it, then
start a fresh agent and inspect the startup container check. Select published
tag `v4.2.1`, which resolves to commit
`12861dc824d934fbd53814f05ded85761b63c6ec`. Update to future published versions
deliberately; do not use the former preview branches for normal adoption.
For a read-only Buildx home, use the persistent environment and ownership
guidance in the [common host recipe](../docs/shared-host.md). Match that setting
to the actual provider interface; no saved-environment field names are assumed.

Image build installs tools. Install checks their presence without starting services;
running processes do not survive the build snapshot. Start checks the daemon,
tries the existing service or default `dockerd` only as an already-authorized root
user when necessary, then executes the container smoke test. It does not invoke
sudo or add daemon flags. An unavailable explicitly configured Docker endpoint
is reported without starting a replacement daemon. Default-daemon startup logs
are at `/tmp/living-proof-docker-start.log`. A non-root or restricted runtime
without a usable daemon
is a real blocker requiring provider review, not permission to alter security.

No Cursor saved environment or account settings are modified by these files.
Fresh-agent startup remains unverified, including provider daemon capabilities;
the portable Docker build and existing-daemon tests are separate evidence.
