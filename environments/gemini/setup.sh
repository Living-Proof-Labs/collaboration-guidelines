#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# 1. Strip non-interactive early-return guard from ~/.bashrc and persist PATH / Playwright browser path
sed -i '/case \$- in/,/esac/d' "$HOME/.bashrc" 2>/dev/null || true

mkdir -p "$HOME/.local/bin" "$HOME/.local/opt"

EXPORT_PATH_LINE='export PATH="$HOME/.local/opt/docs/bin:$HOME/.local/bin:$PATH"'
grep -qxF "$EXPORT_PATH_LINE" "$HOME/.bashrc" 2>/dev/null || echo "$EXPORT_PATH_LINE" >> "$HOME/.bashrc"

EXPORT_PW_LINE='export PLAYWRIGHT_BROWSERS_PATH="$HOME/.local/opt/browsers"'
grep -qxF "$EXPORT_PW_LINE" "$HOME/.bashrc" 2>/dev/null || echo "$EXPORT_PW_LINE" >> "$HOME/.bashrc"

export PATH="$HOME/.local/opt/docs/bin:$HOME/.local/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.local/opt/browsers"

# 2. Install Task v3.54.0 (matching repository Dockerfile version and SHA-256 checksum)
if ! command -v task >/dev/null 2>&1 || ! task --version 2>/dev/null | grep -q '3.54.0'; then
  tmp_installer="$(mktemp)"
  curl -fsSL https://raw.githubusercontent.com/go-task/task/v3.54.0/install-task.sh -o "$tmp_installer"
  echo "e360c4d49273347e8ceb740f98d81d0b8b753de7d1b3c3452bdae7ec54289b99  $tmp_installer" | sha256sum -c -
  sh "$tmp_installer" -b "$HOME/.local/bin" v3.54.0
  rm -f "$tmp_installer"
fi

# 3. Install Python 3.10 and 3.12 via uv (for repositories with UV_PYTHON_DOWNLOADS=never / --no-python-downloads)
if command -v uv >/dev/null 2>&1; then
  uv python install 3.10 3.12
fi

# 4. Pre-warm uv wheel cache for direct GitHub Release wheel URLs (avoids HEAD->S3 401 redirect)
if command -v uv >/dev/null 2>&1; then
  python3 - <<'PY'
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil, subprocess, tempfile, threading, zlib

URLS = [
    ("livingproof-common", "3c976aabb51fc4f5", "https://github.com/Living-Proof-Labs/livingproof-common/releases/download/v1.0.0/livingproof_common-1.0.0-py3-none-any.whl"),
    ("livingproof-capability-report", "5abd691313f35bcc", "https://github.com/Living-Proof-Labs/livingproof-capability-report/releases/download/v3.5.0/livingproof_capability_report-3.5.0-py3-none-any.whl"),
]

def patch_cache_file(path: Path, old_url: bytes, new_url: bytes):
    raw = path.read_bytes()
    if new_url in raw:
        return
    data_len = int.from_bytes(raw[-8:], "little")
    patched_body = raw[:-12].replace(old_url, new_url)
    new_crc = zlib.crc32(patched_body[data_len:] + raw[-8:])
    path.write_bytes(patched_body + new_crc.to_bytes(4, "little") + raw[-8:])

with tempfile.TemporaryDirectory() as tmpdir:
    tmp = Path(tmpdir)
    wheel_bytes = {}
    for pkg, _, url in URLS:
        whl_name = url.rsplit("/", 1)[-1]
        whl_path = tmp / whl_name
        subprocess.run(["curl", "-fsSL", url, "-o", str(whl_path)], check=True)
        wheel_bytes[whl_name] = whl_path.read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def do_HEAD(self):
            whl_name = self.path.rsplit("/", 1)[-1]
            data = wheel_bytes[whl_name]
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
        def do_GET(self):
            whl_name = self.path.rsplit("/", 1)[-1]
            data = wheel_bytes[whl_name]
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(data)
        def log_message(self, *args):
            pass

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        venv_dir = tmp / "venv"
        subprocess.run(["uv", "venv", "-q", str(venv_dir)], check=True)
        py_bin = str(venv_dir / "bin/python")
        prefix = f"http://127.0.0.1:{httpd.server_port}/"
        for pkg, target_hash, url in URLS:
            whl_name = url.rsplit("/", 1)[-1]
            pad_len = len(url) - len(prefix) - len(whl_name) - 1
            local_url = f"{prefix}{'x' * pad_len}/{whl_name}"
            subprocess.run(["uv", "pip", "install", "-q", "-p", py_bin, "--dry-run", local_url], check=True)
            subprocess.run(["uv", "pip", "install", "-q", "-p", py_bin, "--no-deps", local_url], check=True)

            src_pkg_dir = None
            for f in (Path.home() / ".cache/uv").rglob(f"*{pkg}*/*.msgpack"):
                if local_url.encode() in f.read_bytes():
                    src_pkg_dir = f.parent
                    break
            if src_pkg_dir is not None:
                dst_pkg_dir = src_pkg_dir.parent.parent / target_hash / pkg
                if dst_pkg_dir.exists():
                    shutil.rmtree(dst_pkg_dir)
                dst_pkg_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(src_pkg_dir, dst_pkg_dir)
                for mf in dst_pkg_dir.iterdir():
                    if mf.is_file() and mf.suffix in (".http", ".msgpack"):
                        patch_cache_file(mf, local_url.encode(), url.encode())
    finally:
        httpd.shutdown()
        httpd.server_close()
PY
fi

# 5. Create Python virtual environment for documentation and browser testing
if [ ! -x "$HOME/.local/opt/docs/bin/python" ]; then
  python3 -m venv "$HOME/.local/opt/docs"
fi

# 6. Install repository tooling and Playwright Chromium when present
GUIDELINES_DIR="/home/antigravity/Living-Proof-Labs/collaboration-guidelines"
if [ -d "$GUIDELINES_DIR" ]; then
  (
    cd "$GUIDELINES_DIR"
    task setup
  )
fi

SPECS_DIR="/home/antigravity/Living-Proof-Labs/robot-capability-specs"
if [ -d "$SPECS_DIR" ]; then
  (
    cd "$SPECS_DIR"
    task -t Taskfile.runtime.yml setup
  )
  playwright install chromium
fi

# 7. Register preconfigured local proxy CA certificates in ~/.pki/nssdb for headless Chromium
if command -v certutil >/dev/null 2>&1 && [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  mkdir -p "$HOME/.pki/nssdb"
  if [ ! -f "$HOME/.pki/nssdb/cert9.db" ]; then
    certutil -d "sql:$HOME/.pki/nssdb" -N --empty-password
  fi
  for cert in /usr/local/share/ca-certificates/*.crt; do
    [ -f "$cert" ] || continue
    name="$(basename "$cert" .crt)"
    certutil -d "sql:$HOME/.pki/nssdb" -D -n "$name" 2>/dev/null || true
    certutil -d "sql:$HOME/.pki/nssdb" -A -t "CT,C,C" -n "$name" -i "$cert"
  done
  python3 - <<'PY'
import os, re, subprocess, tempfile
from pathlib import Path

bundle = Path("/etc/ssl/certs/ca-certificates.crt").read_text()
certs = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", bundle, re.S)
nssdb = f"sql:{Path.home() / '.pki/nssdb'}"
for idx, pem in enumerate(certs):
    subj = subprocess.check_output(["openssl", "x509", "-noout", "-subject"], input=pem, text=True).strip()
    if any(k in subj for k in ("Antigravity", "Agent Gateway", "Local", "Proxy")):
        with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as f:
            f.write(pem)
            tmp = f.name
        try:
            name = f"custom-ca-{idx}"
            subprocess.run(["certutil", "-d", nssdb, "-D", "-n", name], stderr=subprocess.DEVNULL)
            subprocess.run(["certutil", "-d", nssdb, "-A", "-t", "CT,C,C", "-n", name, "-i", tmp], check=True)
        finally:
            os.unlink(tmp)
PY
fi
