// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(path.join(root, 'renovate.json'), 'utf8'));
const preset = JSON.parse(readFileSync(path.join(root, 'renovate-preset.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(root, 'docs-brand.lock.json'), 'utf8'));

test('the only guidelines Renovate preset pin is the published v9.4.0 tag', () => {
  assert.deepEqual(config.extends, [
    'github>Living-Proof-Labs/collaboration-guidelines:renovate-preset#v9.4.0',
  ]);
});

test('the shared preset keeps docs-brand updates disabled, and this PR does not change the lock', () => {
  const brandRules = preset.packageRules.filter(rule => (rule.matchDepTypes ?? []).includes('docs-brand'));
  assert.equal(brandRules.length, 1);
  assert.equal(brandRules[0].enabled, false);
  assert.equal(lock.repository, 'Living-Proof-Labs/collaboration-guidelines');
  assert.equal(lock.version, 'v7.10.9');
  assert.equal(lock.commit, 'c5fa9d9794d0ebd289f51b247fe7872de0db9c27');
  assert.equal(lock.sha256, 'd62706445615a9de9dfa743872010b6d1d55e7d05b64764dd7f02a068dff4c54');
});
