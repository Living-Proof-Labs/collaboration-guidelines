#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
: "${RENOVATE_TOKEN:?A repository-scoped GitHub App installation token is required}"
: "${DOCS_BRAND_REPOSITORY:?Set the single consumer repository}"
[[ $DOCS_BRAND_REPOSITORY =~ ^Living-Proof-Labs/[A-Za-z0-9_.-]+$ ]] || exit 2
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
image=$(cat "$root/tools/renovate/image.txt")
# The consumer is cloned inside this disposable container. No source checkout,
# Docker socket, private key, or writable policy mount is provided to Renovate.
docker run --rm --user "$(id -u):$(id -g)" \
  -e RENOVATE_TOKEN -e DOCS_BRAND_REPOSITORY -e HOME=/tmp -e LOG_LEVEL=info \
  -e RENOVATE_CONFIG_FILE=/policy/tools/docs-brand/runner.cjs \
  -v "$root:/policy:ro" \
  -v "$root/tools/docs-brand/lock.mjs:/opt/docs-brand/lock.mjs:ro" \
  --entrypoint renovate "$image"
