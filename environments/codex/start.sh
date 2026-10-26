#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
export PATH="$PATH:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
# Codex runtimes differ. Reuse a provider-managed daemon; never invent flags or
# change networking/storage/security settings to make an unsupported daemon run.
bash "$root/environments/host/check.sh" smoke
