#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
if ! docker info >/dev/null 2>&1; then
  if [[ -n ${DOCKER_HOST:-} || $(docker context show) != default ]]; then
    echo 'Configured Docker endpoint is unavailable; preserve it and report the provider connection failure.' >&2
    exit 1
  fi
  if [[ $(id -u) != 0 ]]; then
    echo 'Docker needs provider-authorized startup; no automatic sudo or privilege change.' >&2
    exit 1
  fi
  if [[ -x /etc/init.d/docker ]]; then
    service docker start
  else
    # Minimal images have no init system. Start the packaged daemon with its
    # existing/default configuration; never weaken storage/network/security flags.
    nohup dockerd > /tmp/living-proof-docker-start.log 2>&1 &
  fi
  for attempt in {1..30}; do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
bash "$root/environments/host/check.sh" smoke
