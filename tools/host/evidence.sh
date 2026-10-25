#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
mkdir -p artifacts
{
  printf 'guidelines_commit='; git rev-parse HEAD
  printf 'recorded_at='; date -u +%FT%TZ
  if [[ ${GITHUB_ACTIONS:-false} == true ]]; then
    printf 'execution=GitHub Actions\nrun=%s/%s/actions/runs/%s\n' "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID"
  else
    printf 'execution=existing authorized local Docker daemon; provider freshness unverified\n'
  fi
  docker info --format 'server={{.ServerVersion}} os={{.OSType}} architecture={{.Architecture}}' || echo 'Docker server unavailable'
  for image in living-proof-host:local collaboration-tooling:local living-proof-reporter-validation:local; do
    printf 'image=%s\n' "$image"
    docker image inspect "$image" --format 'id={{.Id}} platform={{.Os}}/{{.Architecture}} digests={{json .RepoDigests}}' || echo 'Image unavailable'
  done
} > artifacts/execution.txt 2>&1
