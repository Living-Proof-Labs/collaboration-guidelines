#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
# Cross-repository consumer proof only; never edit or publish reporter sources.
repo=https://github.com/Living-Proof-Labs/livingproof-capability-report.git
ref=v1.4.0
expected=bbdc54544b900bfed9ef7e799e94f45dbe6d8df3
mkdir -p artifacts
output=$(cd artifacts && pwd)
work=$(mktemp -d)
cid=
cleanup() {
  [[ -z $cid ]] || docker rm -f "$cid" >/dev/null
  rm -rf -- "$work"
}
trap cleanup EXIT
git clone --quiet --depth 1 --branch "$ref" "$repo" "$work/report"
test "$(git -C "$work/report" rev-parse HEAD)" = "$expected"
printf '%s %s %s\n' "$repo" "$ref" "$expected" > "$output/reporter-source.txt"
# Same documented development target; copy the isolated checkout so this works
# with an authorized remote/socket daemon without host-path mount assumptions.
args=()
if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then
  args+=(--secret "id=ca,src=$HOST_BUILD_CA_FILE")
fi
docker build "${args[@]}" --target development -t living-proof-reporter-validation:local "$work/report"
runtime_args=()
if [[ -n ${HOST_BUILD_CA_FILE:-} ]]; then
  runtime_args+=(--mount "type=bind,src=$HOST_BUILD_CA_FILE,dst=/run/provider-ca.pem,readonly" --env SSL_CERT_FILE=/run/provider-ca.pem)
fi
cid=$(docker create "${runtime_args[@]}" --user 0:0 living-proof-reporter-validation:local bash -ec 'task setup && task test')
docker cp "$work/report/." "$cid:/workspace/report/"
status=0
docker start -a "$cid" || status=$?
docker cp "$cid:/workspace/report/artifacts/tests.xml" "$output/reporter.xml" || status=1
exit "$status"
