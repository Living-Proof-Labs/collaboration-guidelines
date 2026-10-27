#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
case ${1:-} in
  build)
    args=()
    if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then args+=(--secret "id=ca,src=$HOST_BUILD_CA_FILE"); fi
    source_commit=$(git rev-parse HEAD)
    source_dirty=false
    if [[ -n $(git status --porcelain) ]]; then source_dirty=true; fi
    docker build "${args[@]}" --build-arg SOURCE_COMMIT="$source_commit" \
      --build-arg SOURCE_DIRTY="$source_dirty" \
      -f tools/manual/Dockerfile -t collaboration-manual:local .
    ;;
  verify)
    mkdir -p artifacts
    if [[ -e artifacts/manual ]]; then
      archive=$(mktemp -d artifacts/manual-previous.XXXXXX)
      mv artifacts/manual "$archive/"
    fi
    mkdir -p artifacts/manual
    # Rebuild the source snapshot (cached dependency layers) before verifying.
    # Identity is embedded in that image, never supplied from a later checkout.
    bash tools/manual/container.sh build
    cid=$(docker create --network none -e GITHUB_RUN_ID="${GITHUB_RUN_ID:-}" \
      collaboration-manual:local)
    trap 'docker rm -f "$cid" >/dev/null' EXIT
    status=0
    docker start -a "$cid" || status=$?
    docker cp "$cid:/work/artifacts/manual/." artifacts/manual/ || status=1
    exit "$status"
    ;;
  *) echo 'Usage: container.sh build|verify' >&2; exit 2 ;;
esac
