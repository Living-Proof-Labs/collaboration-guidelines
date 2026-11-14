#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
image=$(cat tools/renovate/image.txt)
case ${1:-} in verify|extract) ;; *) echo 'Usage: task renovate:verify or task renovate:extract' >&2; exit 2 ;; esac
mkdir -p artifacts/renovate
# No credentials, Docker socket, network, or writable source mount.
docker run --rm --network none --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e LOG_LEVEL=debug \
  -v "$PWD:/repo:ro" -v "$PWD/artifacts/renovate:/reports" \
  --entrypoint bash "$image" /repo/tools/renovate/container.sh "$1"
