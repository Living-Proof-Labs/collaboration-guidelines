#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
# Keep both architecture hashes together when updating Task.
version=3.54.0
case "$(dpkg --print-architecture)" in
  amd64) arch=amd64; sha=680859dbb4d881a9c72d4d9a8f510825450849af8567deacd7302c01124416fb ;;
  arm64) arch=arm64; sha=d7189d439d4a6058e39e1b2acd7c8b27acd4856691b408f23b242e4294e1df5b ;;
  *) echo 'Unsupported tooling architecture' >&2; exit 1 ;;
esac
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
curl --fail --show-error --location "https://github.com/go-task/task/releases/download/v${version}/task_linux_${arch}.tar.gz" -o "$archive"
printf '%s  %s\n' "$sha" "$archive" | sha256sum --check -
tar -xzf "$archive" -C /usr/local/bin task
task --version
