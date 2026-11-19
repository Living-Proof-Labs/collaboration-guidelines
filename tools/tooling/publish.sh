#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_SHA:?}" "${GITHUB_ACTOR:?}" "${RELEASE_TAG:?}"
[[ $RELEASE_TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected stable version tag' >&2; exit 1; }
# Reject published releases and failed lookups before any registry writes.
# Immutable historical releases must never be repaired by this publisher.
draft=$(gh release view "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --json isDraft --jq '.isDraft')
[[ $draft == true ]] || { echo "Expected an unpublished draft release: $RELEASE_TAG" >&2; exit 1; }
image="ghcr.io/${GITHUB_REPOSITORY,,}/tooling"
# Fail closed on authentication, network and unexpected registry errors. Never
# replace an existing version (including partial publications after failure).
require_absent() {
  local ref=$1 error
  error=$(mktemp)
  if docker manifest inspect "$ref" > /dev/null 2> "$error"; then
    echo "Refusing to overwrite $ref" >&2; rm "$error"; return 1
  fi
  if ! grep -Eiq 'manifest unknown|no such manifest|manifest.*not found' "$error"; then
    cat "$error" >&2; rm "$error"; return 1
  fi
  rm "$error"
}
printf '%s' "$GH_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
for suffix in '' -amd64 -arm64; do require_absent "$image:$RELEASE_TAG$suffix"; done
# Validate both artifacts before the first registry write.
for arch in amd64 arm64; do
  (cd tooling-candidate && sha256sum --check "$arch.sha256")
  gzip -dc "tooling-candidate/$arch.tar.gz" | docker load
  candidate="collaboration-tooling:${GITHUB_SHA}-${arch}"
  test "$(docker image inspect --format '{{.Architecture}}' "$candidate")" = "$arch"
  test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$candidate")" = "$GITHUB_SHA"
done
for arch in amd64 arm64; do
  docker tag "collaboration-tooling:${GITHUB_SHA}-${arch}" "$image:$RELEASE_TAG-$arch"
  docker push "$image:$RELEASE_TAG-$arch"
done
docker manifest create "$image:$RELEASE_TAG" "$image:$RELEASE_TAG-amd64" "$image:$RELEASE_TAG-arm64"
docker manifest push "$image:$RELEASE_TAG"
mkdir -p artifacts
docker buildx imagetools inspect "$image:$RELEASE_TAG" --format '{{json .Manifest}}' > artifacts/tooling-index.json
for arch in amd64 arm64; do
  docker buildx imagetools inspect "$image:$RELEASE_TAG-$arch" --format '{{json .Manifest}}' > "artifacts/tooling-$arch.json"
done
node tools/tooling/record-index.mjs "$image" "$RELEASE_TAG" "$GITHUB_SHA"
gh release upload "$RELEASE_TAG" artifacts/tooling-index.json artifacts/tooling-image.json --repo "$GITHUB_REPOSITORY"
# Publication locks assets: only finalize after both evidence uploads succeed.
gh release edit "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --draft=false
cat artifacts/tooling-image.json >> "$GITHUB_STEP_SUMMARY"
