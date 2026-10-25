#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
# Image build owns installation; snapshot install verifies persisted tools.
bash "$root/environments/host/check.sh" tools
