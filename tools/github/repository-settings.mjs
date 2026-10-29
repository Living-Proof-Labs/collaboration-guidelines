#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/** Audit or deliberately apply Living Proof Labs' repository defaults. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const configPath = new URL('../../config/github/repositories.json', import.meta.url);
const allowedOwners = new Set(['Living-Proof-Labs']);

export function parseArgs(args) {
  let repository;
  let apply = false;
  let applyMainRuleset = false;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') apply = true;
    else if (argument === '--apply-main-ruleset') applyMainRuleset = true;
    else if (argument === '--help') help = true;
    else if (argument === '--repo') {
      repository = args[index + 1];
      if (!repository || repository.startsWith('-')) throw new Error('--repo requires a repository name.');
      index += 1;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (applyMainRuleset && !apply) throw new Error('--apply-main-ruleset requires --apply.');
  if (apply && !repository) throw new Error('--apply requires exactly one --repo from the declaration.');
  return { apply, applyMainRuleset, help, repository };
}

export function differences(actual, desired) {
  return Object.entries(desired)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => ({ field: key, actual: actual[key], desired: value }));
}

export function normalizeRuleset(ruleset) {
  const byType = Object.fromEntries((ruleset.rules ?? []).map((rule) => [rule.type, rule]));
  const pullRequest = byType.pull_request?.parameters ?? {};
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    conditions: { ref_name: {
      include: [...(ruleset.conditions?.ref_name?.include ?? [])].sort(),
      exclude: [...(ruleset.conditions?.ref_name?.exclude ?? [])].sort()
    } },
    bypass_actors: (ruleset.bypass_actors ?? [])
      .map(({ actor_id: actorId, actor_type: actorType, bypass_mode: bypassMode }) => ({ actor_id: actorId, actor_type: actorType, bypass_mode: bypassMode }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    rules: [
      ...(byType.deletion ? [{ type: 'deletion' }] : []),
      ...(byType.non_fast_forward ? [{ type: 'non_fast_forward' }] : []),
      ...(byType.pull_request ? [{ type: 'pull_request', parameters: {
        required_approving_review_count: pullRequest.required_approving_review_count,
        require_code_owner_review: pullRequest.require_code_owner_review,
        require_last_push_approval: pullRequest.require_last_push_approval,
        required_review_thread_resolution: pullRequest.required_review_thread_resolution,
        allowed_merge_methods: [...(pullRequest.allowed_merge_methods ?? [])].sort()
      } }] : [])
    ]
  };
}

export function rulesetState(existing, desired) {
  if (!existing) return 'missing';
  return JSON.stringify(normalizeRuleset(existing)) === JSON.stringify(normalizeRuleset(desired)) ? 'matches' : 'different';
}

/** Preserve all non-managed policy when correcting the fields this manifest owns. */
export function updateRulesetPayload(existing, desired) {
  const existingByType = Object.fromEntries((existing.rules ?? []).map((rule) => [rule.type, rule]));
  const desiredByType = Object.fromEntries((desired.rules ?? []).map((rule) => [rule.type, rule]));
  const managedTypes = new Set(Object.keys(desiredByType));
  const rules = (existing.rules ?? []).filter((rule) => !managedTypes.has(rule.type));
  for (const rule of desired.rules) {
    if (rule.type === 'pull_request') {
      rules.push({
        type: 'pull_request',
        parameters: {
          ...(existingByType.pull_request?.parameters ?? {}),
          ...rule.parameters
        }
      });
    } else rules.push(rule);
  }
  return {
    name: desired.name,
    target: desired.target,
    enforcement: desired.enforcement,
    conditions: { ...(existing.conditions ?? {}), ...desired.conditions },
    bypass_actors: desired.bypass_actors,
    rules
  };
}

export function validateConfig(config, selectedRepository) {
  if (!allowedOwners.has(config.owner)) throw new Error(`Owner is not allowlisted: ${config.owner}`);
  if (config.schema_version !== 1) throw new Error(`Unsupported configuration schema version: ${config.schema_version}`);
  if (!Array.isArray(config.repositories) || new Set(config.repositories).size !== config.repositories.length) throw new Error('Repository declaration must contain unique repository names.');
  if (selectedRepository && !config.repositories.includes(selectedRepository)) throw new Error(`Repository is not declared for ${config.owner}: ${selectedRepository}`);
}

function usage() {
  return `Usage: node tools/github/repository-settings.mjs [--repo NAME] [--apply [--apply-main-ruleset]]

Without --apply, only GET requests are made. Omit --repo to audit every declared
repository, or use it to audit one. --apply requires exactly one declared repo.
--apply updates general settings and immutable releases after verification.
--apply-main-ruleset additionally changes main protection after owner approval.`;
}

function gh(method, endpoint, body) {
  const args = ['api', '--method', method, endpoint];
  if (body !== undefined) args.push('--input', '-');
  return execFileSync('gh', args, { input: body === undefined ? undefined : `${JSON.stringify(body)}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function statusFrom(error) {
  const detail = `${error.stderr ?? ''}\n${error.message ?? ''}`;
  const found = detail.match(/HTTP (\d{3})/);
  return found ? Number(found[1]) : undefined;
}

export function immutableStateFrom(get, endpoint) {
  try {
    const response = get(`${endpoint}/immutable-releases`);
    return response?.enabled === true ? 'enabled' : 'unknown';
  } catch (error) { return statusFrom(error) === 404 ? 'disabled' : 'unknown'; }
}

const defaultApi = {
  get(endpoint) { return JSON.parse(gh('GET', endpoint)); },
  write(method, endpoint, body) { gh(method, endpoint, body); },
  immutableState(endpoint) { return immutableStateFrom(this.get.bind(this), endpoint); }
};

function inspectRuleset(api, endpoint, desired) {
  const summary = api.get(`${endpoint}/rulesets`);
  const match = summary.find((ruleset) => ruleset.name === desired.name);
  if (!match) return { state: 'missing' };
  return { state: rulesetState(api.get(`${endpoint}/rulesets/${match.id}`), desired), id: match.id };
}

function assertVerified(label, state) {
  if (state !== 'matches' && state !== 'enabled') throw new Error(`${label} verification failed: ${state}`);
}

export function run({ config, flags, api = defaultApi, log = console.log }) {
  validateConfig(config, flags.repository);
  const repositories = flags.repository ? [flags.repository] : config.repositories;
  const report = { repositories: [], failures: [] };
  for (const repository of repositories) {
    const endpoint = `repos/${config.owner}/${repository}`;
    const result = {
      repository, settings: [], settingsOutcome: 'unchanged', immutableReleases: 'unknown',
      immutableOutcome: 'unknown', mainRuleset: 'unknown', mainRulesetOutcome: 'not-requested'
    };
    report.repositories.push(result);
    try {
      const actual = api.get(endpoint);
      result.settings = differences(actual, config.repository);
      result.immutableReleases = api.immutableState(endpoint);
      result.mainRuleset = inspectRuleset(api, endpoint, config.main_ruleset).state;
      log(`${config.owner}/${repository}`);
      log(result.settings.length ? `  repository settings: ${result.settings.length} difference(s)` : '  repository settings: match');
      for (const item of result.settings) log(`  ${item.field}: ${JSON.stringify(item.actual)} -> ${JSON.stringify(item.desired)}`);
      log(`  immutable releases: ${result.immutableReleases}`);
      log(`  main ruleset: ${result.mainRuleset}`);
      if (!flags.apply) continue;
      if (result.settings.length) {
        api.write('PATCH', endpoint, config.repository);
        const verification = differences(api.get(endpoint), config.repository);
        if (verification.length) throw new Error(`repository settings verification failed: ${verification.map((item) => item.field).join(', ')}`);
        result.settings = [];
        result.settingsOutcome = 'applied';
      }
      if (result.immutableReleases === 'disabled') {
        api.write('PUT', `${endpoint}/immutable-releases`);
        assertVerified('immutable releases', api.immutableState(endpoint));
        result.immutableReleases = 'enabled';
        result.immutableOutcome = 'applied';
      } else if (result.immutableReleases === 'enabled') {
        result.immutableOutcome = 'unchanged';
      }
      if (flags.applyMainRuleset) {
        const ruleset = inspectRuleset(api, endpoint, config.main_ruleset);
        if (ruleset.state === 'missing') api.write('POST', `${endpoint}/rulesets`, config.main_ruleset);
        else if (ruleset.state === 'different') {
          const existing = api.get(`${endpoint}/rulesets/${ruleset.id}`);
          api.write('PUT', `${endpoint}/rulesets/${ruleset.id}`, updateRulesetPayload(existing, config.main_ruleset));
        }
        assertVerified('main ruleset', inspectRuleset(api, endpoint, config.main_ruleset).state);
        result.mainRuleset = 'matches';
        result.mainRulesetOutcome = ruleset.state === 'matches' ? 'unchanged' : 'applied';
      }
      log(`  outcome: settings=${result.settingsOutcome}; immutable-releases=${result.immutableOutcome}; main-ruleset=${result.mainRulesetOutcome}`);
    } catch (error) {
      const failure = { repository, error: error.message };
      report.failures.push(failure);
      log(`  ERROR: ${failure.error}`);
    }
  }
  return report;
}

export function reportDifferences(report) {
  return report.repositories.reduce((total, result) => total + result.settings.length + (result.immutableReleases === 'enabled' ? 0 : 1) + (result.mainRuleset === 'matches' ? 0 : 1), 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const flags = parseArgs(process.argv.slice(2));
    if (flags.help) { console.log(usage()); process.exit(0); }
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const report = run({ config, flags });
    console.log(`\n${reportDifferences(report)} difference(s) found; ${report.failures.length} error(s).`);
    process.exit(report.failures.length ? 1 : 0);
  } catch (error) { console.error(error.message); process.exit(1); }
}
