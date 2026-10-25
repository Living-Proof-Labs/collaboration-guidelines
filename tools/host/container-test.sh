#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
mkdir -p artifacts
rm -f artifacts/guidelines.xml
cid=$(docker create collaboration-tooling:local)
trap 'docker rm -f "$cid" >/dev/null' EXIT
status=0
docker start -a "$cid" || status=$?
docker cp "$cid:/work/artifacts/." artifacts/ || status=1
exit "$status"
