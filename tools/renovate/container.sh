#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
cd /repo
if [[ $1 == verify ]]; then
  rm -f /reports/tests.xml /reports/tests.log /reports/validator.log
  renovate-config-validator --strict --no-global renovate-preset.json 2>&1 | tee /reports/validator.log
  node --test --test-reporter=spec --test-reporter=junit \
    --test-reporter-destination=stdout --test-reporter-destination=/reports/tests.xml \
    tools/renovate/test.mjs 2>&1 | tee /reports/tests.log
else
  # A disposable plain directory avoids Git ownership and cannot write to origin.
  mkdir /tmp/pilot
  tar --exclude=.git --exclude=artifacts -cf - . | tar -xf - -C /tmp/pilot
  cp renovate-preset.json /tmp/pilot/renovate.json
  cd /tmp/pilot
  renovate --platform=local --dry-run=extract 2>&1 | tee /reports/extract.log
fi
