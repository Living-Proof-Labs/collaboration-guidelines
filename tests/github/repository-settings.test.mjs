// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { comparable, differences, parseArgs } from '../../tools/github/repository-settings.mjs';

test('reports only fields that differ from the declaration', () => {
  const desired = { has_wiki: false, allow_merge_commit: true };
  const actual = { has_wiki: true, allow_merge_commit: true };
  assert.deepEqual(differences(actual, desired), [
    { field: 'has_wiki', actual: true, desired: false }
  ]);
  assert.deepEqual(comparable(actual, desired), {
    has_wiki: false,
    allow_merge_commit: true
  });
});

test('does not permit accidental branch-policy application', () => {
  assert.throws(() => parseArgs(['--apply-main-ruleset']), /requires --apply/);
  assert.deepEqual(parseArgs(['--apply', '--apply-main-ruleset']), {
    apply: true,
    applyMainRuleset: true,
    help: false
  });
});

test('rejects unknown options', () => {
  assert.throws(() => parseArgs(['--yes']), /Unknown option/);
});
