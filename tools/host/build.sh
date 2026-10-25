#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
args=()
# Optional existing provider trust bundle, never copied into an image layer.
if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then args+=(--secret "id=ca,src=$HOST_BUILD_CA_FILE"); fi
case ${1:-} in
  host) docker build "${args[@]}" -f environments/host/Dockerfile -t living-proof-host:local . ;;
  tooling) docker build "${args[@]}" --target tooling -t collaboration-tooling:local . ;;
  *) echo 'Usage: build.sh host|tooling' >&2; exit 2 ;;
esac
