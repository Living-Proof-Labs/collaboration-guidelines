// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  differences, immutableStateFrom, loadInventory, normalizeRuleset, parseArgs, reportDifferences, rulesetState, run,
  updateRulesetPayload, validateConfig
} from '../../tools/github/repository-settings.mjs';

const desiredRuleset = {
  name: 'Protect main: pull requests only', target: 'branch', enforcement: 'active',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } }, bypass_actors: [],
  rules: [
    { type: 'deletion' }, { type: 'non_fast_forward' },
    { type: 'pull_request', parameters: {
      required_approving_review_count: 0, require_code_owner_review: false,
      dismiss_stale_reviews_on_push: false,
      require_last_push_approval: false, required_review_thread_resolution: false,
      allowed_merge_methods: ['merge']
    } }
  ]
};
const policy = { schema_version: 1, repository: { has_wiki: false }, main_ruleset: desiredRuleset };
const inventory = { schema_version: 1, owner: 'example-org', repositories: ['example'] };

function fakeApi({ repository = { has_wiki: false }, immutable = 'enabled', ruleset } = {}) {
  const writes = [];
  const api = {
    get(endpoint) {
      if (endpoint.endsWith('/rulesets')) return ruleset ? [{ id: 7, name: ruleset.name }] : [];
      if (endpoint.endsWith('/rulesets/7')) return ruleset;
      return repository;
    },
    immutableState() { return immutable; },
    write(method, endpoint, body) { writes.push({ method, endpoint, body }); }
  };
  return { api, writes };
}

test('reports only fields that differ from the declaration', () => {
  assert.deepEqual(differences({ has_wiki: true }, { has_wiki: false }), [
    { field: 'has_wiki', actual: true, desired: false }
  ]);
});

test('does not permit accidental apply or an undeclared target', () => {
  assert.throws(() => parseArgs(['--inventory', 'inventory.json', '--apply-main-ruleset']), /requires --apply/);
  assert.throws(() => parseArgs(['--inventory', 'inventory.json', '--apply']), /requires exactly one --repo/);
  assert.throws(() => parseArgs([]), /--inventory is required/);
  assert.throws(() => validateConfig(policy, inventory, 'other'), /not declared/);
  assert.deepEqual(parseArgs(['--inventory', 'inventory.json', '--apply', '--repo', 'example']), {
    apply: true, applyMainRuleset: false, help: false, inventoryPath: 'inventory.json', repository: 'example'
  });
});

test('rejects malformed owner or repository inventory before any API write', () => {
  const { api, writes } = fakeApi();
  assert.throws(() => run({ policy, inventory: { ...inventory, owner: '../unsafe' }, flags: parseArgs(['--inventory', 'inventory.json']), api, log: () => {} }), /owner/);
  assert.throws(() => run({ policy, inventory: { ...inventory, repositories: [3] }, flags: parseArgs(['--inventory', 'inventory.json']), api, log: () => {} }), /repository names/);
  assert.deepEqual(writes, []);
});

test('rejects inventory paths outside the consumer or through a symlink', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'inventory-root-'));
  const outside = mkdtempSync(path.join(tmpdir(), 'inventory-outside-'));
  writeFileSync(path.join(outside, 'inventory.json'), JSON.stringify(inventory));
  symlinkSync(path.join(outside, 'inventory.json'), path.join(root, 'linked.json'));
  assert.throws(() => loadInventory(path.relative(root, path.join(outside, 'inventory.json')), root), /inside/);
  assert.throws(() => loadInventory('linked.json', root), /inside/);
});

test('normalizes server defaults and rule order before comparing', () => {
  const serverResponse = {
    ...desiredRuleset, id: 7, rules: [...desiredRuleset.rules].reverse(),
    conditions: { ref_name: { exclude: [], include: ['~DEFAULT_BRANCH'] } },
    extra_server_field: 'ignored'
  };
  assert.equal(rulesetState(serverResponse, desiredRuleset), 'matches');
});

test('declares GitHub-required pull-request ruleset parameters', () => {
  const pullRequest = desiredRuleset.rules.find((rule) => rule.type === 'pull_request');
  assert.equal(pullRequest.parameters.dismiss_stale_reviews_on_push, false);
  assert.deepEqual(pullRequest.parameters.allowed_merge_methods, ['merge']);
});

test('does not turn an omitted ruleset bypass list into an empty list', () => {
  const omitted = { ...desiredRuleset };
  delete omitted.bypass_actors;
  assert.equal(normalizeRuleset(omitted).bypass_actors, undefined);
  assert.equal(rulesetState(omitted, desiredRuleset), 'unknown');
  assert.equal(rulesetState({ ...desiredRuleset, bypass_actors: [] }, desiredRuleset), 'matches');
});

test('audits sponsorships through the documented GraphQL field', () => {
  const sponsorshipPolicy = { ...policy, graphql_repository: { hasSponsorshipsEnabled: false } };
  const { api } = fakeApi({ ruleset: desiredRuleset });
  api.graphqlRepository = () => ({ hasSponsorshipsEnabled: false });
  const matching = run({ policy: sponsorshipPolicy, inventory, flags: parseArgs(['--inventory', 'inventory.json']), api, log: () => {} });
  assert.deepEqual(matching.repositories[0].sponsorships, []);
  api.graphqlRepository = () => ({ hasSponsorshipsEnabled: true });
  const drifted = run({ policy: sponsorshipPolicy, inventory, flags: parseArgs(['--inventory', 'inventory.json']), api, log: () => {} });
  assert.deepEqual(drifted.repositories[0].sponsorships, [{ field: 'graphql.hasSponsorshipsEnabled', actual: true, desired: false }]);
});

test('ruleset update preserves unmanaged protections and parameters', () => {
  const existing = {
    ...desiredRuleset,
    rules: [
      ...desiredRuleset.rules.map((rule) => rule.type === 'pull_request' ? {
        ...rule, parameters: { ...rule.parameters, dismiss_stale_reviews_on_push: true }
      } : rule),
      { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test' }] } }
    ]
  };
  const changed = { ...desiredRuleset, enforcement: 'evaluate' };
  const payload = updateRulesetPayload(existing, changed);
  const pullRequest = payload.rules.find((rule) => rule.type === 'pull_request');
  assert.equal(pullRequest.parameters.dismiss_stale_reviews_on_push, false);
  assert.deepEqual(payload.rules.find((rule) => rule.type === 'required_status_checks'), existing.rules[3]);
  assert.equal(payload.enforcement, 'evaluate');
});

test('immutable-release audit distinguishes enabled, disabled, and unknown', () => {
  assert.equal(immutableStateFrom(() => ({ enabled: true }), 'repos/example'), 'enabled');
  assert.equal(immutableStateFrom(() => ({ enabled: false }), 'repos/example'), 'unknown');
  assert.equal(immutableStateFrom(() => { throw { stderr: 'HTTP 404 Not Found' }; }, 'repos/example'), 'disabled');
  assert.equal(immutableStateFrom(() => { throw { stderr: 'HTTP 403 Forbidden' }; }, 'repos/example'), 'unknown');
});

test('read-only audit inspects missing rulesets and writes nothing', () => {
  const { api, writes } = fakeApi({ immutable: 'unknown' });
  const report = run({ policy, inventory, flags: parseArgs(['--inventory', 'inventory.json']), api, log: () => {} });
  assert.equal(report.repositories[0].mainRuleset, 'missing');
  assert.equal(report.repositories[0].immutableReleases, 'unknown');
  assert.equal(reportDifferences(report), 2);
  assert.deepEqual(writes, []);
  assert.equal(report.repositories[0].mainRulesetOutcome, 'not-requested');
});

test('apply is a no-op when normalized state already matches', () => {
  const { api, writes } = fakeApi({ ruleset: desiredRuleset });
  const report = run({ policy, inventory, flags: parseArgs(['--inventory', 'inventory.json', '--apply', '--apply-main-ruleset', '--repo', 'example']), api, log: () => {} });
  assert.deepEqual(report.failures, []);
  assert.deepEqual(writes, []);
});
