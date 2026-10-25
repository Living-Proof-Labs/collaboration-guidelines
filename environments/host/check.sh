#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
mode=${1:-daemon}
case $mode in tools|daemon|smoke) ;; *) echo 'Usage: check.sh [tools|daemon|smoke]' >&2; exit 2 ;; esac
for tool in docker task git gh glab curl jq ssh; do
  command -v "$tool" >/dev/null || { echo "Missing host tool: $tool" >&2; exit 1; }
done
docker --version
docker compose version
docker buildx version
task --version
git --version
gh --version | head -1
glab --version
[[ $mode == tools ]] && exit 0
# Version output alone is insufficient. Do not print daemon configuration or env.
docker info --format 'Docker server {{.ServerVersion}} ({{.OSType}}/{{.Architecture}})' || {
  echo 'Docker daemon unavailable. Use the provider-approved startup; do not change privileges, socket permissions, or networking to bypass this.' >&2
  exit 1
}
if [[ $mode == smoke ]]; then
  docker run --rm --network none ubuntu:24.04@sha256:68ee22004a9109b44973313b02ff7b1de250f1de0f5ecb628d73f579aaff33ac sh -ec 'test "$(uname -m)" = x86_64; printf "container execution passed\n"'
fi
