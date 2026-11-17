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
  symlinkSync,
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

  // Only reviewed local utilities are reachable. Install/network commands are
  // mocks; no host tooling, startup files, credentials, or environment leak in.
  for (const name of ["bash", "mkdir", "dirname", "grep", "chmod", "cat"]) {
    symlinkSync(`/bin/${name}`, join(bin, name));
  }
  const stub = (name, body, directory = bin) => {
    mkdirSync(directory, { recursive: true });
    const file = join(directory, name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
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
  stub("playwright", `echo "playwright $*" >> "${log}"`);

  const bashrc = join(home, ".bashrc");
  const originalBashrc =
    'case $- in\n  *i*) ;;\n  *) return ;;\nesac\nexport CUSTOM_KEEP="yes"\n';
  writeFileSync(bashrc, originalBashrc);

  const env = {
    HOME: home,
    PATH: bin,
    GEMINI_LOCAL_BIN: join(home, ".local/bin"),
    GEMINI_LOCAL_OPT: join(home, ".local/opt"),
    GEMINI_ENV_FILE: join(home, ".local/share/living-proof/gemini-env.sh"),
    GEMINI_GUIDELINES_DIR: join(root, "missing-guidelines"),
    GEMINI_SPECS_DIR: join(root, "missing-specs"),
  };

  try {
    callback({ home, bashrc, originalBashrc, env, log, stub });
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

test("docs-only setup warns about skipped dependencies when specs are absent", () => {
  withStubbedEnv(({ env, log }) => {
    mkdirSync(env.GEMINI_GUIDELINES_DIR);
    const result = spawnSync("bash", [SETUP_SCRIPT], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /documentation dependency setup and Playwright Chromium installation were skipped/);
    assert.match(result.stderr, /docs environment may be incomplete/);
    assert.ok(result.stderr.includes(env.GEMINI_SPECS_DIR));
    assert.match(result.stderr, /Set GEMINI_SPECS_DIR to an existing checkout and rerun/);
    const calls = readFileSync(log, "utf8");
    assert.match(calls, /^task setup$/m);
    assert.doesNotMatch(calls, /Taskfile.runtime.yml|playwright install|curl|certutil/);
  });
});

test("present checkouts run mocked repository and browser setup without the skip warning", () => {
  withStubbedEnv(({ env, log }) => {
    mkdirSync(env.GEMINI_GUIDELINES_DIR);
    mkdirSync(env.GEMINI_SPECS_DIR);
    const result = spawnSync("bash", [SETUP_SCRIPT], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const calls = readFileSync(log, "utf8");
    assert.match(calls, /^task setup$/m);
    assert.match(calls, /^task -t Taskfile.runtime.yml setup$/m);
    assert.match(calls, /^playwright install chromium$/m);
    assert.doesNotMatch(calls, /curl|certutil/);
  });
});

test("a fresh noninteractive shell explicitly sources the generated environment", () => {
  withStubbedEnv(({ env, stub, bashrc, originalBashrc }) => {
    const setup = spawnSync("bash", [SETUP_SCRIPT], { env, encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stderr);
    stub("task", 'echo "local task"', env.GEMINI_LOCAL_BIN);
    const fresh = spawnSync("bash", ["--noprofile", "--norc", "-c", `
      set -eu
      case $- in *i*) exit 90 ;; esac
      test -z "\${PLAYWRIGHT_BROWSERS_PATH+x}"
      . "$GEMINI_ENV_FILE"
      test "$PATH" = "$GEMINI_LOCAL_OPT/docs/bin:$GEMINI_LOCAL_BIN:$ORIGINAL_PATH"
      test "$(command -v python)" = "$GEMINI_LOCAL_OPT/docs/bin/python"
      test "$(command -v task)" = "$GEMINI_LOCAL_BIN/task"
      test "$PLAYWRIGHT_BROWSERS_PATH" = "$GEMINI_LOCAL_OPT/browsers"
      task
    `], { env: { ...env, ORIGINAL_PATH: env.PATH }, encoding: "utf8" });
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.equal(fresh.stdout.trim(), "local task");
    assert.equal(readFileSync(bashrc, "utf8"), originalBashrc);
  });
});
