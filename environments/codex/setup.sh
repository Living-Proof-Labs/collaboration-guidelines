#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
# Run only in the provider's explicitly authorized root setup phase.
bash "$root/environments/host/install.sh"
