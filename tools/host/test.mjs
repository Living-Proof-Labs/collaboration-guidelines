// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const script = new URL('../../environments/host/check.sh', import.meta.url).pathname;
function fixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'host-check-'));
  const add = (name, body = 'exit 0') => {
    const file = join(dir, name); writeFileSync(file, '#!/bin/sh\n' + body + '\n'); chmodSync(file, 0o755);
  };
  for (const name of ['docker', 'task', 'git', 'gh', 'glab', 'curl', 'jq', 'ssh', 'head']) add(name);
  const run = mode => spawnSync('/bin/bash', [script, mode], {encoding:'utf8', env:{PATH:dir}});
  try { callback({dir, add, run}); } finally { rmSync(dir, {recursive:true, force:true}); }
}
test('host checker rejects unknown modes', () => fixture(({run}) => assert.equal(run('unknown').status, 2)));
test('host checker fails when a required collaboration tool is missing', () => fixture(({dir,run}) => {
  rmSync(join(dir, 'glab')); const r = run('tools'); assert.equal(r.status, 1); assert.match(r.stderr, /Missing host tool: glab/);
}));
test('tool inventory does not pretend to verify the daemon', () => fixture(({add,run}) => {
  add('docker', 'if [ "$1" = info ]; then exit 9; fi'); assert.equal(run('tools').status, 0); assert.equal(run('daemon').status, 1);
}));
test('daemon success cannot hide failed container execution', () => fixture(({add,run}) => {
  add('docker', 'if [ "$1" = run ]; then exit 7; fi'); assert.equal(run('smoke').status, 7);
}));
test('smoke actually requests container execution without network', () => fixture(({dir,add,run}) => {
  const log = join(dir, 'calls'); add('docker', `printf '%s\\n' "$*" >> '${log}'`);
  assert.equal(run('smoke').status, 0); assert.match(readFileSync(log,'utf8'), /run --rm --network none ubuntu:24\.04@sha256:/);
}));
// Temporary draft-only fixture: remove after the failed case and red gate are verified remotely.
test('temporary report publication failure fixture', () => assert.fail('Intentional reporting validation failure'));
