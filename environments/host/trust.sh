#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Reuse explicit provider trust input; never discover, install or disable trust.
HOST_BUILD_CA_FILE=${HOST_BUILD_CA_FILE:-${SSL_CERT_FILE:-}}
if [[ -n $HOST_BUILD_CA_FILE && ! -r $HOST_BUILD_CA_FILE ]]; then
  echo 'Configured provider CA bundle is not readable.' >&2
  return 2
fi
export HOST_BUILD_CA_FILE
