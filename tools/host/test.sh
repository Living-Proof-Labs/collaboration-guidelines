#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
mkdir -p artifacts
npm run check --prefix .github/actions/semantic-release
node --test --test-reporter=spec --test-reporter=junit --test-reporter-destination=stdout --test-reporter-destination=artifacts/guidelines.xml .github/actions/semantic-release/test/*.test.mjs tools/host/test.mjs
