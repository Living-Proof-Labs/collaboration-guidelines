#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Provisioned commands must be available without relying on login-shell profiles.
export PATH="$PATH:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
source "$root/trust.sh"
if [[ -n $HOST_BUILD_CA_FILE ]]; then export CURL_CA_BUNDLE=$HOST_BUILD_CA_FILE; fi
# Only provisioning/build phases run this installer. It never starts a daemon.
source /etc/os-release
case "$ID:$VERSION_ID" in
  ubuntu:24.04) package_file=packages.txt ;;
  debian:13) package_file=packages-debian13.txt ;;
  *) echo 'Host installation supports Ubuntu 24.04 or Debian 13; use check.sh on other prepared hosts.' >&2; exit 2 ;;
esac
if [[ $(uname -m) != x86_64 ]]; then
  echo 'Host installation supports amd64 only.' >&2
  exit 2
fi
if [[ $(id -u) != 0 ]]; then
  echo 'Installation needs an authorized root provisioning/build phase; no automatic sudo.' >&2
  exit 2
fi
packages=()
while IFS= read -r spec; do
  [[ -z $spec || $spec == \#* ]] && continue
  name=${spec%%=*}
  case $name in
    docker.io|docker-cli) command -v docker >/dev/null && continue ;;
    docker-compose-v2|docker-compose) docker compose version >/dev/null 2>&1 && continue ;;
    docker-buildx) docker buildx version >/dev/null 2>&1 && continue ;;
    openssh-client) command -v ssh >/dev/null && continue ;;
    ca-certificates) [[ -s /etc/ssl/certs/ca-certificates.crt ]] && continue ;;
    *) command -v "$name" >/dev/null && continue ;;
  esac
  packages+=("$spec")
done < "$root/$package_file"
# Do not mix distribution packages with an existing alternative Docker install.
if command -v docker >/dev/null && { ! docker compose version >/dev/null 2>&1 || ! docker buildx version >/dev/null 2>&1; }; then
  echo 'Existing Docker lacks Compose or Buildx; provision matching plugins separately. Existing installation left unchanged.' >&2
  exit 2
fi
work=$(mktemp -d)
created_policy=false
cleanup() {
  rm -rf -- "$work"
  if $created_policy; then rm -f /usr/sbin/policy-rc.d; fi
}
trap cleanup EXIT
if ((${#packages[@]})); then
  # Preserve a provider's existing service policy. Suppress package service starts
  # only when no policy exists, and remove our temporary file on every exit.
  if [[ ! -e /usr/sbin/policy-rc.d && ! -L /usr/sbin/policy-rc.d ]]; then
    printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
    chmod 755 /usr/sbin/policy-rc.d
    created_policy=true
  fi
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${packages[@]}"
fi
if ! command -v task >/dev/null; then
  curl --fail --silent --show-error --location --retry 3 \
    https://github.com/go-task/task/releases/download/v3.54.0/task_linux_amd64.tar.gz \
    -o "$work/task.tar.gz"
  printf '%s  %s\n' 680859dbb4d881a9c72d4d9a8f510825450849af8567deacd7302c01124416fb "$work/task.tar.gz" | sha256sum --check --status
  tar -xzf "$work/task.tar.gz" -C "$work" task
  install -m 755 "$work/task" /usr/local/bin/task
fi
bash "$root/check.sh" tools
