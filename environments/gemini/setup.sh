#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

# Scoped user-space bootstrap for Google Gemini Antigravity.
# Leaves ~/.bashrc and NSS certificate trust unchanged.

LOCAL_BIN="${GEMINI_LOCAL_BIN:-$HOME/.local/bin}"
LOCAL_OPT="${GEMINI_LOCAL_OPT:-$HOME/.local/opt}"
ENV_FILE="${GEMINI_ENV_FILE:-$HOME/.local/share/living-proof/gemini-env.sh}"
PLAYWRIGHT_DIR="${PLAYWRIGHT_BROWSERS_PATH:-$LOCAL_OPT/browsers}"
TASK_VERSION="3.54.0"
TASK_INSTALLER_SHA256="e360c4d49273347e8ceb740f98d81d0b8b753de7d1b3c3452bdae7ec54289b99"

mkdir -p "$LOCAL_BIN" "$LOCAL_OPT" "$(dirname "$ENV_FILE")"

cat >"$ENV_FILE" <<EOF
# SPDX-License-Identifier: Apache-2.0
export PATH="$LOCAL_OPT/docs/bin:$LOCAL_BIN:\$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_DIR"
EOF

export PATH="$LOCAL_OPT/docs/bin:$LOCAL_BIN:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_DIR"

# 1. Install Task v3.54.0 into user-space bin (verified by SHA-256 checksum)
if ! command -v task >/dev/null 2>&1 || ! task --version 2>/dev/null | grep -q "$TASK_VERSION"; then
  tmp_installer="$(mktemp)"
  curl -fsSL "https://raw.githubusercontent.com/go-task/task/v${TASK_VERSION}/install-task.sh" -o "$tmp_installer"
  echo "${TASK_INSTALLER_SHA256}  $tmp_installer" | sha256sum -c -
  sh "$tmp_installer" -b "$LOCAL_BIN" "v${TASK_VERSION}"
  rm -f "$tmp_installer"
fi

# 2. Install Python 3.10 and 3.12 via uv (for repos with UV_PYTHON_DOWNLOADS=never)
if command -v uv >/dev/null 2>&1; then
  uv python install 3.10 3.12
fi

# 3. Create Python virtual environment for documentation and browser testing
if [ ! -x "$LOCAL_OPT/docs/bin/python" ]; then
  python3 -m venv "$LOCAL_OPT/docs"
fi

# 4. Install repository tooling when checkouts are present
GUIDELINES_DIR="${GEMINI_GUIDELINES_DIR:-/home/antigravity/Living-Proof-Labs/collaboration-guidelines}"
if [ -d "$GUIDELINES_DIR" ]; then
  (
    cd "$GUIDELINES_DIR"
    task setup
  )
fi

SPECS_DIR="${GEMINI_SPECS_DIR:-/home/antigravity/Living-Proof-Labs/robot-capability-specs}"
if [ -d "$SPECS_DIR" ]; then
  (
    cd "$SPECS_DIR"
    task -t Taskfile.runtime.yml setup
  )
  if command -v playwright >/dev/null 2>&1; then
    playwright install chromium
  fi
fi
