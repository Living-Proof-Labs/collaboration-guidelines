#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
mkdir -p artifacts
socket=${DOCKER_HOST:-unix:///var/run/docker.sock}
[[ $socket == unix://* ]] || { echo 'Integration requires an already-authorized local Unix Docker socket.' >&2; exit 2; }
socket=${socket#unix://}
[[ -S $socket ]] || { echo 'Existing Docker socket unavailable.' >&2; exit 2; }
failed=0
report=artifacts/host.xml
printf '<testsuites><testsuite name="shared-host">\n' > "$report"
run_case() {
  local name=$1
  shift
  printf '<testcase classname="shared-host" name="%s">' "$name" >> "$report"
  if "$@" > "artifacts/host-$name.log" 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name (see retained log)"
    printf '<failure message="Command failed; see retained host log"/>' >> "$report"
    failed=1
  fi
  printf '</testcase>\n' >> "$report"
}
run_case tools-without-project-runtimes docker run --rm living-proof-host:local bash -ec '
  bash /opt/living-proof-host/check.sh tools
  ! command -v python3
  ! command -v uv
  ! command -v node
  dpkg-query -W
'
run_case repeat-install-preserves-config docker run --rm living-proof-host:local bash -ec '
  mkdir -p /root/.config/gh /root/.config/glab-cli /root/.docker
  printf "# preserve-me\n" | tee /root/.config/gh/hosts.yml /root/.config/glab-cli/config.yml >/dev/null
  printf "{\"auths\":{}}\n" > /root/.docker/config.json
  before=$(sha256sum /root/.config/gh/hosts.yml /root/.config/glab-cli/config.yml /root/.docker/config.json)
  bash /opt/living-proof-host/install.sh
  after=$(sha256sum /root/.config/gh/hosts.yml /root/.config/glab-cli/config.yml /root/.docker/config.json)
  test "$before" = "$after"
'
# Explicitly reuses the existing authorized daemon. It is NOT a new nested daemon.
run_case daemon-and-container docker run --rm --mount "type=bind,src=$socket,dst=/var/run/docker.sock" living-proof-host:local bash /opt/living-proof-host/check.sh smoke
run_case compose-and-buildx docker run --rm --mount "type=bind,src=$socket,dst=/var/run/docker.sock" living-proof-host:local bash -ec '
  work=$(mktemp -d)
  cd "$work"
  image="living-proof-host-probe:$(date +%s)-$$"
  trap '\''docker image rm "$image" >/dev/null 2>&1 || true; rm -rf "$work"'\'' EXIT
  printf "FROM ubuntu:24.04@sha256:68ee22004a9109b44973313b02ff7b1de250f1de0f5ecb628d73f579aaff33ac\nRUN test -x /bin/sh\nCMD [\"sh\", \"-ec\", \"test -f /etc/os-release\"]\n" > Dockerfile
  docker buildx build --load -t "$image" .
  printf "services:\n  probe:\n    image: %s\n    network_mode: none\n" "$image" > compose.yml
  docker compose -p "host-probe-$$" run --rm probe
'
printf '</testsuite></testsuites>\n' >> "$report"
exit "$failed"
