// SPDX-License-Identifier: Apache-2.0
// Review guards for the docs brand Renovate runner: trigger, permission, pin,
// secret-flow, policy and lock-tamper invariants. Offline; no credentials.
import test, {describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import YAML from 'yaml';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = file => readFileSync(join(root, file), 'utf8');
const workflowFile = '.github/workflows/docs-brand-renovate.yml';
const actionFile = '.github/actions/docs-brand-renovate/action.yml';
const workflow = YAML.parse(read(workflowFile));
const action = YAML.parse(read(actionFile));
const lockModule = await import(pathToFileURL(join(root, 'tools/docs-brand/lock.mjs')).href);
const runnerPolicy = () => {
  const old = process.env.DOCS_BRAND_REPOSITORY;
  process.env.DOCS_BRAND_REPOSITORY = 'Living-Proof-Labs/fixture';
  const path = join(root, 'tools/docs-brand/runner.cjs');
  const require = createRequire(import.meta.url);
  delete require.cache[path];
  try { return require(path); }
  finally { if (old === undefined) delete process.env.DOCS_BRAND_REPOSITORY; else process.env.DOCS_BRAND_REPOSITORY = old; }
};
const steps = action.runs.steps;
const tokenStep = steps.find(step => step.id === 'token');
const allUses = [...Object.values(workflow.jobs).flatMap(job => (job.steps ?? []).map(s => s.uses).concat(job.uses ?? [])), ...steps.map(s => s.uses)].filter(Boolean);
const runScripts = [...Object.values(workflow.jobs).flatMap(job => (job.steps ?? []).map(s => s.run)), ...steps.map(s => s.run)].filter(Boolean);

describe('Docs brand runner: triggers and injection', () => {
  test('reusable workflow is callable only; no pull_request_target or push trigger', () => {
    assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
    const code = read(workflowFile).split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
    assert.doesNotMatch(code, /pull_request_target|workflow_run|repository_dispatch/);
  });
  test('secret-bearing job requires schedule/dispatch, the default branch and the org owner', () => {
    const condition = workflow.jobs.update.if.replace(/\s+/g, ' ');
    for (const clause of ["github.event_name == 'schedule'", "github.event_name == 'workflow_dispatch'",
      "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
      "github.repository_owner == 'Living-Proof-Labs'"]) assert.ok(condition.includes(clause), clause);
    assert.doesNotMatch(condition, /\|\|\s*true|always\(\)/);
  });
  test('no run script interpolates an expression; attacker-influenced contexts never appear', () => {
    for (const script of runScripts) assert.doesNotMatch(script, /\$\{\{/);
    const text = read(workflowFile) + read(actionFile);
    for (const context of ['head_ref', 'github.event.pull_request', 'github.event.issue', 'github.event.comment',
      'github.event.head_commit', 'github.event.workflow_run', 'inputs.app-private-key }}"']) assert.equal(text.includes(context), false, context);
  });
  test('invocation guard runs before any credential is used and reads only non-secret context', () => {
    assert.equal(steps.indexOf(tokenStep), 1);
    const guard = steps[0];
    assert.equal(guard.uses, undefined);
    assert.deepEqual(Object.keys(guard.env).sort(), ['CALLER_EVENT', 'CALLER_REF', 'CALLER_REPOSITORY', 'DEFAULT_BRANCH']);
    assert.doesNotMatch(JSON.stringify({env: guard.env, run: guard.run}), /secret|private-key|token/i);
  });
  test('guard script fails closed for every untrusted event and accepts only the two trusted events', () => {
    const base = {PATH: process.env.PATH, CALLER_EVENT: 'schedule', CALLER_REF: 'refs/heads/main', DEFAULT_BRANCH: 'main', CALLER_REPOSITORY: 'Living-Proof-Labs/fixture'};
    const run = env => spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', steps[0].run], {env: {...base, ...env}});
    for (const CALLER_EVENT of ['pull_request', 'pull_request_target', 'workflow_run', 'push', 'issue_comment', 'repository_dispatch', 'merge_group', ''])
      assert.notEqual(run({CALLER_EVENT}).status, 0, CALLER_EVENT);
    for (const override of [{CALLER_REF: 'refs/heads/main2'}, {CALLER_REF: 'refs/tags/main'}, {CALLER_REF: 'refs/pull/1/merge'},
      {DEFAULT_BRANCH: ''}, {CALLER_REPOSITORY: 'Living-Proof-Labs/a/b'}, {CALLER_REPOSITORY: 'living-proof-labs-x/a'}, {CALLER_REPOSITORY: 'Living-Proof-Labs/a b'}])
      assert.notEqual(run(override).status, 0, JSON.stringify(override));
    for (const CALLER_EVENT of ['schedule', 'workflow_dispatch']) assert.equal(run({CALLER_EVENT}).status, 0, CALLER_EVENT);
  });
});

describe('Docs brand runner: permissions, pins and credentials', () => {
  test('workflow GITHUB_TOKEN is read-only and no job widens it', () => {
    assert.deepEqual(workflow.permissions, {contents: 'read'});
    for (const job of Object.values(workflow.jobs)) assert.ok(job.permissions === undefined || !JSON.stringify(job.permissions).includes('write'));
    assert.doesNotMatch(read(workflowFile), /write-all|read-all/);
  });
  test('every remote action is pinned to a full commit with a version comment; only $/ is local', () => {
    assert.ok(allUses.length >= 2);
    for (const uses of allUses) {
      if (uses.startsWith('$/')) { assert.match(uses, /^\$\/\.github\/actions\/[a-z0-9-]+$/); continue; }
      assert.doesNotMatch(uses, /^\.\//, 'workspace-relative actions would load caller content');
      assert.match(uses, /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+(\/[^@]+)?@[0-9a-f]{40}$/, uses);
    }
    const remote = read(actionFile).split('\n').filter(l => /^\s*(-\s+)?uses:\s*[^$\s]/.test(l));
    assert.ok(remote.length >= 1);
    for (const line of remote) assert.match(line, /@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, line);
  });
  test('installation token is scoped to the caller repository with the reviewed permission set only', () => {
    assert.match(tokenStep.uses, /^actions\/create-github-app-token@[0-9a-f]{40}$/);
    const permissions = Object.fromEntries(Object.entries(tokenStep.with).filter(([k]) => k.startsWith('permission-')));
    assert.deepEqual(permissions, {'permission-contents': 'write', 'permission-pull-requests': 'write', 'permission-checks': 'read', 'permission-statuses': 'read'});
    for (const key of ['owner', 'repositories', 'skip-token-revoke', 'app-id', 'enterprise', 'github-api-url']) assert.equal(key in tokenStep.with, false, key);
  });
  test('the private key reaches only the token action; Renovate gets only the installation token', () => {
    const keyRefs = steps.filter(step => JSON.stringify(step).includes('inputs.app-private-key'));
    assert.deepEqual(keyRefs, [tokenStep]);
    const writer = steps.at(-1);
    assert.equal(writer.env.RENOVATE_TOKEN, '${{ steps.token.outputs.token }}');
    assert.equal(steps.filter(step => JSON.stringify(step).includes('steps.token.outputs.token')).length, 1);
    assert.equal(workflow.on.workflow_call.secrets['app-private-key'].required, true);
    assert.deepEqual(Object.keys(workflow.on.workflow_call.secrets), ['app-private-key']);
    assert.doesNotMatch(read(workflowFile), /secrets:\s*inherit/);
  });
  test('Renovate image is pinned once by digest and every launcher reads that file', () => {
    const image = read('tools/renovate/image.txt').trim();
    assert.match(image, /^renovate\/renovate:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
    for (const file of ['tools/renovate/run.sh', 'tools/docs-brand/run.sh']) {
      assert.match(read(file), /image\.txt/, file);
      assert.doesNotMatch(read(file), /renovate\/renovate:/, `${file} must not hard-code another image`);
    }
  });
  test('container launch passes no secret value, socket, writable mount or privileged flag', () => {
    const script = read('tools/docs-brand/run.sh');
    assert.doesNotMatch(script, /--privileged|--cap-add|docker\.sock|--network[ =]host|-e [A-Z_]+=\$|PRIVATE_KEY|GITHUB_TOKEN|--env-file/);
    const mounts = [...script.matchAll(/-v "([^"]+)"/g)].map(m => m[1]);
    assert.equal(mounts.length, 2);
    assert.ok(mounts.every(m => m.endsWith(':ro')), mounts.join());
  });
});

describe('Docs brand runner: trusted Renovate policy', () => {
  test('global policy ignores consumer config and enables only the root brand-lock regex manager', () => {
    const policy = runnerPolicy();
    assert.equal(policy.requireConfig, 'ignored');
    assert.equal(policy.inheritConfig, false);
    assert.equal(policy.onboarding, false);
    assert.equal(policy.autodiscover, false);
    assert.deepEqual(policy.repositories, ['Living-Proof-Labs/fixture']);
    assert.deepEqual(policy.enabledManagers, ['custom.regex']);
    assert.equal(policy.customManagers.length, 1);
    const [manager] = policy.customManagers;
    assert.deepEqual(manager.managerFilePatterns, ['/^docs-brand\\.lock\\.json$/']);
    assert.equal(manager.depTypeTemplate, 'docs-brand');
    assert.equal(manager.datasourceTemplate, 'github-releases');
    assert.equal(manager.depNameTemplate, 'Living-Proof-Labs/collaboration-guidelines');
    assert.equal(manager.matchStrings.length, 1);
    assert.ok(manager.matchStrings[0].includes('(?<currentValue>v[0-9]+\\.[0-9]+\\.[0-9]+)'));
    assert.equal(/registryUrl|packageName|extractVersion/.test(JSON.stringify(manager)), false);
  });
  test('no automerge, scripts, plugins, shell, env exposure or dashboard; one bot branch namespace', () => {
    const policy = runnerPolicy();
    for (const key of ['automerge', 'platformAutomerge', 'allowScripts', 'allowPlugins', 'exposeAllEnv', 'allowShellExecutorForPostUpgradeCommands', 'dependencyDashboard', 'cloneSubmodules'])
      assert.equal(policy[key], false, key);
    assert.deepEqual(policy.allowedEnv, []);
    assert.equal(policy.vulnerabilityAlerts.enabled, false);
    assert.equal(policy.branchPrefix, 'renovate-docs-brand/');
    assert.equal(policy.prConcurrentLimit, 1);
    assert.equal('hostRules' in policy || 'npmrc' in policy || 'customEnvVariables' in policy || 'env' in policy, false);
    for (const rule of policy.packageRules) {
      assert.deepEqual(rule.matchDepTypes, ['docs-brand']);
      assert.notEqual(rule.automerge, true);
    }
  });
  test('allowedCommands admits exactly the opt-in helper command and nothing near it', () => {
    const policy = runnerPolicy();
    const optIn = JSON.parse(read('renovate-docs-brand.json'));
    assert.equal(optIn.packageRules.length, 1);
    const tasks = optIn.packageRules[0].postUpgradeTasks;
    assert.deepEqual(tasks.commands, ['node /opt/docs-brand/lock.mjs --update']);
    assert.deepEqual(tasks.fileFilters, ['docs-brand.lock.json']);
    assert.equal(tasks.executionMode, 'branch');
    assert.deepEqual(policy.allowedCommands, ['^node /opt/docs-brand/lock\\.mjs --update$']);
    const allowed = command => policy.allowedCommands.some(pattern => new RegExp(pattern).test(command));
    assert.equal(allowed(tasks.commands[0]), true);
    for (const command of ['node /opt/docs-brand/lock.mjs --update; id', 'node /opt/docs-brand/lock.mjs --update\nid',
      'node /opt/docs-brand/lockXmjs --update', 'node /opt/docs-brand/lock.mjs --check', 'node ./lock.mjs --update',
      'node /opt/docs-brand/lock.mjs --update --other', 'bash -c "node /opt/docs-brand/lock.mjs --update"', ' node /opt/docs-brand/lock.mjs --update'])
      assert.equal(allowed(command), false, command);
  });
  test('shared preset keeps the brand dependency disabled and opt-in never automerges', () => {
    const preset = JSON.parse(read('renovate-preset.json'));
    const brandRules = preset.packageRules.filter(rule => JSON.stringify(rule.matchDepTypes ?? []).includes('docs-brand'));
    assert.equal(brandRules.length, 1);
    assert.equal(brandRules[0].enabled, false);
    assert.equal(preset.packageRules.slice(preset.packageRules.indexOf(brandRules[0]) + 1).some(r => r.enabled === true), false);
    const optIn = JSON.parse(read('renovate-docs-brand.json'));
    assert.equal(optIn.packageRules[0].automerge, false);
    assert.equal(optIn.packageRules[0].platformAutomerge, false);
    const managers = preset.customManagers.filter(m => m.depTypeTemplate === 'docs-brand');
    assert.deepEqual(managers, runnerPolicy().customManagers);
  });
});

// Lock tamper detection with mocked GitHub transport (no network).
const css = Buffer.from('body { color: teal; }\n');
const cssNew = Buffer.from('body { color: aqua; }\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const commits = {'v1.0.0': '1'.repeat(40), 'v1.1.0': '2'.repeat(40)};
const transport = (overrides = {}) => url => {
  if (url.includes('/releases/tags/')) { const tag = url.split('/').at(-1); return JSON.stringify({tag_name: tag, draft: false, prerelease: false, ...(overrides.release ?? {})}); }
  if (url.includes('/commits/')) return JSON.stringify({sha: overrides.commit ?? commits[url.split('/').at(-1)]});
  if (url.startsWith('https://raw.githubusercontent.com/')) return url.includes(commits['v1.1.0']) ? cssNew : (overrides.bytes ?? css);
  throw new Error(`unexpected URL ${url}`);
};
const good = {repository: 'Living-Proof-Labs/collaboration-guidelines', version: 'v1.0.0', commit: commits['v1.0.0'], path: 'brand/docs/brand.css', sha256: sha(css)};

describe('Docs brand lock: tamper detection fails closed', () => {
  test('a consistent lock verifies', () => assert.deepEqual(lockModule.verify(good, transport()), good));
  const tampered = {
    'version-only bump (failed or denied post-upgrade task)': {...good, version: 'v1.1.0'},
    'sha256 edited to match other bytes': {...good, sha256: sha(cssNew)},
    'sha256 zeroed': {...good, sha256: '0'.repeat(64)},
    'commit swapped to another release': {...good, commit: commits['v1.1.0']},
    'commit and sha swapped to another release, version kept': {...good, commit: commits['v1.1.0'], sha256: sha(cssNew)},
    'uppercase sha256': {...good, sha256: good.sha256.toUpperCase()},
    'abbreviated commit': {...good, commit: good.commit.slice(0, 12)},
    'foreign repository': {...good, repository: 'attacker/collaboration-guidelines'},
    'different path': {...good, path: 'brand/docs/../../evil.css'},
    'extra field': {...good, url: 'https://evil.example/brand.css'},
    'missing field': (({sha256, ...rest}) => rest)(good),
    'prerelease version': {...good, version: 'v1.0.0-rc.1'},
    'branch name as version': {...good, version: 'main'},
  };
  for (const [name, lock] of Object.entries(tampered)) test(`rejects ${name}`, () => assert.throws(() => lockModule.verify(lock, transport())));
  test('rejects upstream bytes that changed after the lock was written', () =>
    assert.throws(() => lockModule.verify(good, transport({bytes: Buffer.from('body{color:red}')})), /provenance/));
  test('rejects a release tag that now resolves to a different commit', () =>
    assert.throws(() => lockModule.verify(good, transport({commit: '3'.repeat(40)})), /provenance/));
  test('rejects draft or prerelease release metadata on verify', () => {
    for (const release of [{draft: true}, {prerelease: true}, {tag_name: 'v1.0.1'}])
      assert.throws(() => lockModule.verify(good, transport({release})), /published stable/);
  });
  test('upgrade refuses when the committed baseline itself was tampered', () =>
    assert.throws(() => lockModule.upgrade({...good, sha256: '0'.repeat(64)}, {...good, sha256: '0'.repeat(64), version: 'v1.1.0'}, transport()), /provenance/));
  test('--check CLI exits non-zero on a tampered lock and zero on a good one (offline transport)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-check-'));
    const wrapper = join(dir, 'check.mjs');
    const lockUrl = pathToFileURL(join(root, 'tools/docs-brand/lock.mjs')).href;
    writeFileSync(wrapper, `import {main} from ${JSON.stringify(lockUrl)};
const commits=${JSON.stringify(commits)};
const get=url=>url.includes('/releases/tags/')?JSON.stringify({tag_name:url.split('/').at(-1),draft:false,prerelease:false}):url.includes('/commits/')?JSON.stringify({sha:commits[url.split('/').at(-1)]}):Buffer.from(${JSON.stringify(css.toString())});
try{main(['--check'],get)}catch(e){console.error(e.message);process.exitCode=1}`);
    const check = lock => { writeFileSync(join(dir, 'docs-brand.lock.json'), JSON.stringify(lock)); return spawnSync(process.execPath, [wrapper], {cwd: dir, encoding: 'utf8'}); };
    assert.equal(check(good).status, 0);
    for (const lock of [{...good, version: 'v1.1.0'}, {...good, sha256: '0'.repeat(64)}, {...good, commit: commits['v1.1.0']}]) {
      const result = check(lock);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /provenance|Expected/);
    }
  });
  test('--update without a committed baseline fails and leaves the proposal untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-nobase-'));
    execFileSync('git', ['init', '-q'], {cwd: dir});
    const proposed = JSON.stringify({...good, version: 'v1.1.0'});
    writeFileSync(join(dir, 'docs-brand.lock.json'), proposed);
    const cwd = process.cwd();
    try { process.chdir(dir); assert.throws(() => lockModule.main(['--update'], transport())); }
    finally { process.chdir(cwd); }
    assert.equal(readFileSync(join(dir, 'docs-brand.lock.json'), 'utf8'), proposed);
    assert.deepEqual(readdirSync(dir).sort(), ['.git', 'docs-brand.lock.json']);
  });
  test('download uses HTTPS only, follows no redirects and rejects non-200 responses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-curl-'));
    const log = join(dir, 'args.json');
    writeFileSync(join(dir, 'curl'), `#!/usr/bin/env node
require('fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write('body' + '\\n' + (process.env.FAKE_STATUS || '200'));\n`, {mode: 0o755});
    const env = {...process.env, PATH: `${dir}:${process.env.PATH}`};
    const run = status => spawnSync(process.execPath, ['--input-type=module', '-e',
      `import {download} from ${JSON.stringify(pathToFileURL(join(root, 'tools/docs-brand/lock.mjs')).href)}; process.stdout.write(download('https://example.invalid/x'));`],
      {env: {...env, FAKE_STATUS: status}, encoding: 'utf8'});
    const ok = run('200');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, 'body');
    const args = JSON.parse(readFileSync(log, 'utf8'));
    for (const flag of ['--disable', '--fail', '--proto']) assert.ok(args.includes(flag), flag);
    assert.equal(args[args.indexOf('--proto') + 1], '=https');
    assert.equal(args.some(a => /^(-L|--location|-k|--insecure|-u|--user|-H|--header)$/.test(a)), false);
    for (const status of ['301', '302', '204', '206']) assert.notEqual(run(status).status, 0, status);
  });
});
