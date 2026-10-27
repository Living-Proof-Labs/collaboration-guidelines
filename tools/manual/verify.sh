#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
python tools/manual/build.py
python -m pytest tests/manual -q --junitxml=artifacts/manual/tests.xml
