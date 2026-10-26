// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const script = new URL('../../environments/host/check.sh', import.meta.url).pathname;
const trust = new URL('../../environments/host/trust.sh', import.meta.url).pathname;
function trustResult(env) {
  return spawnSync('/bin/bash', ['-ec', 'source "$1"; printf "%s" "$HOST_BUILD_CA_FILE"', 'trust-test', trust], {encoding:'utf8', env});
}
test('provider trust is optional and never inferred from certificate locations', () => {
  const result = trustResult({}); assert.equal(result.status, 0); assert.equal(result.stdout, '');
});
test('explicit trust takes precedence over the provider SSL_CERT_FILE', () => {
  const result = trustResult({HOST_BUILD_CA_FILE:trust, SSL_CERT_FILE:'/missing-provider-bundle'});
  assert.equal(result.status, 0); assert.equal(result.stdout, trust);
});
test('provider SSL_CERT_FILE is reused without altering trust', () => {
  const result = trustResult({SSL_CERT_FILE:trust});
  assert.equal(result.status, 0); assert.equal(result.stdout, trust);
});
test('unreadable configured provider trust fails closed', () => {
  const result = trustResult({SSL_CERT_FILE:'/missing-provider-bundle'});
  assert.equal(result.status, 2); assert.match(result.stderr, /not readable/);
});
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
