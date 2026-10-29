#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Check or deliberately apply Living Proof Labs' repository defaults.
 *
 * This is intentionally opt-in: normal execution is read-only. Applying
 * default-branch rules needs a second flag because it changes who can push.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const configPath = new URL('../../config/github/repositories.json', import.meta.url);

export function parseArgs(args) {
  const flags = new Set(args);
  const known = new Set(['--apply', '--apply-main-ruleset', '--help']);
  const unknown = args.filter((arg) => !known.has(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}`);
  if (flags.has('--apply-main-ruleset') && !flags.has('--apply')) {
    throw new Error('--apply-main-ruleset requires --apply.');
  }
  return {
    apply: flags.has('--apply'),
    applyMainRuleset: flags.has('--apply-main-ruleset'),
    help: flags.has('--help')
  };
}

export function comparable(actual, desired) {
  return Object.fromEntries(Object.entries(desired).map(([key, value]) => [key, actual[key] === value]));
}

export function differences(actual, desired) {
  return Object.entries(desired)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => ({ field: key, actual: actual[key], desired: value }));
}

function usage() {
  return `Usage: node tools/github/repository-settings.mjs [--apply [--apply-main-ruleset]]

Without --apply, only GET requests are made and differences are reported.
--apply updates general repository settings and enables immutable releases.
--apply-main-ruleset additionally creates or updates the main-branch ruleset;
use it only after the owner approves that access-control change.`;
}

function gh(method, endpoint, body) {
  const args = ['api', '--method', method, endpoint];
  if (body !== undefined) args.push('--input', '-');
  return execFileSync('gh', args, {
    input: body === undefined ? undefined : `${JSON.stringify(body)}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function get(endpoint) {
  return JSON.parse(gh('GET', endpoint));
}

function write(method, endpoint, body) {
  gh(method, endpoint, body);
}

function matchingRuleset(rulesets, name) {
  return rulesets.find((ruleset) => ruleset.name === name);
}

function checkImmutableReleases(endpoint) {
  try {
    get(`${endpoint}/immutable-releases`);
    return 'enabled';
  } catch (error) {
    const detail = error.stderr?.toString() ?? error.message;
    if (detail.includes('404')) return 'disabled';
    return 'unavailable';
  }
}

function syncRuleset(endpoint, desired, apply) {
  const existing = matchingRuleset(get(`${endpoint}/rulesets`), desired.name);
  if (!existing) {
    console.log('  main ruleset: missing');
    if (apply) write('POST', `${endpoint}/rulesets`, desired);
    return;
  }
  const current = get(`${endpoint}/rulesets/${existing.id}`);
  const fields = ['target', 'enforcement', 'conditions', 'bypass_actors', 'rules'];
  const changed = fields.some((field) => JSON.stringify(current[field]) !== JSON.stringify(desired[field]));
  console.log(`  main ruleset: ${changed ? 'different' : 'matches'}`);
  if (changed && apply) write('PUT', `${endpoint}/rulesets/${existing.id}`, desired);
}

export function run({ config, flags, api = { get, write, checkImmutableReleases } }) {
  let mismatches = 0;
  for (const repository of config.repositories) {
    const endpoint = `repos/${config.owner}/${repository}`;
    const actual = api.get(endpoint);
    const diff = differences(actual, config.repository);
    const immutable = api.checkImmutableReleases(endpoint);
    console.log(`${config.owner}/${repository}`);
    if (!diff.length) console.log('  repository settings: match');
    for (const item of diff) {
      mismatches += 1;
      console.log(`  ${item.field}: ${JSON.stringify(item.actual)} -> ${JSON.stringify(item.desired)}`);
    }
    if (immutable !== 'enabled') {
      mismatches += 1;
      console.log(`  immutable releases: ${immutable} -> enabled`);
    } else console.log('  immutable releases: enabled');
    if (flags.apply && diff.length) api.write('PATCH', endpoint, config.repository);
    if (flags.apply && immutable === 'disabled') api.write('PUT', `${endpoint}/immutable-releases`);
    if (flags.applyMainRuleset) syncRuleset(endpoint, config.main_ruleset, true);
    else console.log('  main ruleset: not changed (requires --apply-main-ruleset)');
  }
  return mismatches;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const flags = parseArgs(process.argv.slice(2));
    if (flags.help) {
      console.log(usage());
      process.exit(0);
    }
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const mismatches = run({ config, flags });
    console.log(`\n${mismatches ? `${mismatches} difference(s) found.` : 'All managed settings match.'}`);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
