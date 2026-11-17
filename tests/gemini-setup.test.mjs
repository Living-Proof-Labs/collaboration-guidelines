// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const SETUP_SCRIPT = new URL("../environments/gemini/setup.sh", import.meta.url).pathname;

function withStubbedEnv(callback) {
  const root = mkdtempSync(join(tmpdir(), "gemini-setup-test-"));
  const home = join(root, "home");
  const bin = join(root, "bin");
  const log = join(root, "calls.log");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });

  const stub = (name, body) => {
    const file = join(bin, name);
    writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(file, 0o755);
  };

  // Preinstalled task stub returning 3.54.0 so curl/sha256sum are not needed.
  stub("task", `echo "task $*" >> "${log}"\nif [ "\${1:-}" = "--version" ]; then echo "3.54.0"; fi`);
  stub("uv", `echo "uv $*" >> "${log}"`);
  stub(
    "python3",
    `echo "python3 $*" >> "${log}"\nif [ "\${1:-}" = "-m" ] && [ "\${2:-}" = "venv" ]; then\n  mkdir -p "\${3}/bin"\n  printf '#!/usr/bin/env bash\\nexit 0\\n' > "\${3}/bin/python"\n  chmod +x "\${3}/bin/python"\nfi`,
  );
  stub("certutil", `echo "certutil $*" >> "${log}"\nexit 99`);
  stub("curl", `echo "curl $*" >> "${log}"\nexit 99`);

  const bashrc = join(home, ".bashrc");
  const originalBashrc =
    'case $- in\n  *i*) ;;\n  *) return ;;\nesac\nexport CUSTOM_KEEP="yes"\n';
  writeFileSync(bashrc, originalBashrc);

  const env = {
    HOME: home,
    PATH: `${bin}:/usr/bin:/bin`,
    GEMINI_LOCAL_BIN: join(home, ".local/bin"),
    GEMINI_LOCAL_OPT: join(home, ".local/opt"),
    GEMINI_ENV_FILE: join(home, ".local/share/living-proof/gemini-env.sh"),
    GEMINI_GUIDELINES_DIR: join(root, "missing-guidelines"),
    GEMINI_SPECS_DIR: join(root, "missing-specs"),
  };

  try {
    callback({ home, bashrc, originalBashrc, env, log });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("gemini setup is idempotent, preserves .bashrc, and never mutates NSS trust", () => {
  withStubbedEnv(({ home, bashrc, originalBashrc, env, log }) => {
    const first = spawnSync("bash", [SETUP_SCRIPT], { env, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);

    const second = spawnSync("bash", [SETUP_SCRIPT], { env, encoding: "utf8" });
    assert.equal(second.status, 0, second.stderr);

    assert.equal(readFileSync(bashrc, "utf8"), originalBashrc);
    assert.equal(existsSync(join(home, ".pki/nssdb")), false);

    const calls = readFileSync(log, "utf8");
    assert.equal(calls.includes("certutil"), false);
    assert.equal(calls.includes("uv python install 3.10 3.12"), true);

    const envFile = readFileSync(env.GEMINI_ENV_FILE, "utf8");
    assert.match(envFile, /export PATH=/);
    assert.match(envFile, /export PLAYWRIGHT_BROWSERS_PATH=/);
  });
});
