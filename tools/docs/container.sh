#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
case ${1:-} in
  build)
    args=()
    if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then args+=(--secret "id=ca,src=$HOST_BUILD_CA_FILE"); fi
    docker build "${args[@]}" -t collaboration-docs:local templates/generated-docs
    ;;
  verify)
    # Replace only this task's generated output; do not reuse stale reports.
    rm -rf -- artifacts/generated-docs
    mkdir -p artifacts/generated-docs
    cid=$(docker create --network none collaboration-docs:local)
    trap 'docker rm -f "$cid" >/dev/null' EXIT
    status=0
    docker start -a "$cid" || status=$?
    docker cp "$cid:/docs/artifacts/." artifacts/generated-docs/ || status=1
    { git rev-parse HEAD; docker image inspect collaboration-docs:local --format '{{.Id}}'; } > artifacts/generated-docs/source.txt
    exit "$status"
    ;;
  *) echo 'Usage: container.sh build|verify' >&2; exit 2 ;;
esac
