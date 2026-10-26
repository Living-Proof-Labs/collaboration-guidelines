#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
source environments/host/trust.sh
revision=$(git rev-parse HEAD)
state=clean
[[ -z $(git status --porcelain) ]] || state=modified
args=(--label "org.opencontainers.image.revision=$revision" --label "org.livingproof.source-state=$state")
# Optional existing provider trust bundle, never copied into an image layer.
if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then args+=(--secret "id=ca,src=$HOST_BUILD_CA_FILE"); fi
case ${1:-} in
  host)
    case ${HOST_DISTRO:-ubuntu24.04} in
      ubuntu24.04) ;;
      debian13) args+=(--build-arg HOST_BASE=debian:13-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad) ;;
      *) echo 'HOST_DISTRO must be ubuntu24.04 or debian13.' >&2; exit 2 ;;
    esac
    docker build "${args[@]}" -f environments/host/Dockerfile -t living-proof-host:local . ;;
  tooling) docker build "${args[@]}" --target tooling -t collaboration-tooling:local . ;;
  *) echo 'Usage: build.sh host|tooling' >&2; exit 2 ;;
esac
