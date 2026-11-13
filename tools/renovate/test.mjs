// SPDX-License-Identifier: Apache-2.0
// Exercise the pinned official implementation, not a JavaScript approximation of RE2.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, describe } from 'node:test';
import { extractPackageFile as regexExtract } from '/usr/local/renovate/dist/modules/manager/custom/regex/index.js';
import { extractPackageFile as actionsExtract } from '/usr/local/renovate/dist/modules/manager/github-actions/extract.js';
import { extractPackageFile as dockerExtract } from '/usr/local/renovate/dist/modules/manager/dockerfile/extract.js';
import { extractAllPackageFiles as pipExtract } from '/usr/local/renovate/dist/modules/manager/pip-compile/extract.js';
import { extractPackageFile as npmExtract } from '/usr/local/renovate/dist/modules/manager/npm/extract/index.js';
import { doAutoReplace } from '/usr/local/renovate/dist/workers/repository/update/branch/auto-replace.js';
import { GlobalConfig } from '/usr/local/renovate/dist/config/global.js';
import { init } from '/usr/local/renovate/dist/logger/index.js';
await init();
import { applyPackageRules } from '/usr/local/renovate/dist/util/package-rules/index.js';
import { calcLimit, counts, isLimitReached, setCount } from '/usr/local/renovate/dist/workers/global/limits.js';
const read = (file) => readFileSync(file, 'utf8');
const preset = JSON.parse(read('renovate-preset.json'));
const [markdown, task] = preset.customManagers;
const fixture = read('tools/renovate/fixtures/AGENTS.md');
const work = mkdtempSync(join(tmpdir(), 'renovate-test-'));
GlobalConfig.set({localDir: work, cacheDir: join(work, 'cache')});
async function update(content, file, config) {
  const extracted = regexExtract(content, file, config);
  for (const [depIndex, dep] of extracted.deps.entries()) {
    content = await doAutoReplace({...config, ...dep, manager: 'regex', packageFile: file, depIndex, newValue: 'v4.2.2', autoReplaceGlobalMatch: true}, content, false);
    assert.equal(typeof content, 'string');
  }
  return content;
}

describe('Renovate extraction contracts', () => {
test('official regex manager extracts repeated full tags and preserves fragment', () => {
  const result = regexExtract(fixture, 'AGENTS.md', markdown);
  assert.equal(result.deps.length, 2);
  assert.deepEqual(result.deps.map(d => [d.depName, d.currentValue, d.datasource]), Array(2).fill(['Living-Proof-Labs/collaboration-guidelines', 'v4.1.0', 'github-releases']));
  assert.match(result.deps[0].replaceString, /#move-work-forward/);
});

test('official replacement updates label and URL together, leaving history and unmarked fences byte-identical', async () => {
  const output = await update(fixture, 'AGENTS.md', markdown);
  assert.equal(output, fixture.replaceAll('v4.1.0', 'v4.2.2'));
  assert.equal(regexExtract(output, 'AGENTS.md', markdown).deps.every(d => d.currentValue === 'v4.2.2'), true);
});

test('Task variable updates without touching schema, historical variable or command', async () => {
  const input = read('tools/renovate/fixtures/Taskfile.yml');
  assert.equal(await update(input, 'Taskfile.yml', task), input.replace('v4.1.0', 'v4.2.2'));
});

test('unmarked, foreign, moving, partial, prerelease and non-SemVer references are excluded', () => {
  assert.equal(regexExtract(fixture.replaceAll('<!-- renovate: guidelines -->', ''), 'AGENTS.md', markdown), null);
  for (const value of ['main', 'latest', 'v4', 'v4.1', 'v4.1.0-rc.1', 'release-4.1.0']) {
    assert.equal(regexExtract(fixture.replaceAll('v4.1.0', value), 'AGENTS.md', markdown), null, value);
    assert.equal(regexExtract(read('tools/renovate/fixtures/Taskfile.yml').replace('v4.1.0', value), 'Taskfile.yml', task), null, value);
  }
  assert.equal(regexExtract(fixture.replaceAll('Living-Proof-Labs/collaboration-guidelines', 'other/repository'), 'AGENTS.md', markdown), null);
});

test('CRLF input updates without changing line endings', async () => {
  const input = fixture.replaceAll('\n', '\r\n');
  assert.equal(await update(input, 'AGENTS.md', markdown), input.replaceAll('v4.1.0', 'v4.2.2'));
});

test('native workflow and custom documentation receive the same group; no automerge', async () => {
  const content = 'jobs:\n  release:\n    uses: Living-Proof-Labs/collaboration-guidelines/.github/workflows/semantic-release.yml@v4.1.0\n';
  const native = await actionsExtract(content, '.github/workflows/release.yml', {});
  const custom = regexExtract(fixture, 'AGENTS.md', markdown);
  for (const dep of [native.deps[0], custom.deps[0]]) {
    const rule = await applyPackageRules({...preset, ...dep, packageName: dep.packageName ?? dep.depName}, 'test');
    assert.equal(rule.groupName, 'collaboration guidelines');
    assert.equal(rule.automerge, false);
    assert.equal(rule.platformAutomerge, false);
    assert.equal(new RegExp(rule.allowedVersions.slice(1,-1)).test('v4.2.2'), true);
    assert.equal(new RegExp(rule.allowedVersions.slice(1,-1)).test('v4.2.2-rc.1'), false);
  }
});

test('native Docker extraction retains readable tag and existing digest', async () => {
  const result = await dockerExtract(read('Dockerfile'), 'Dockerfile', {});
  const dep = result.deps.find(d => d.depName === 'node');
  assert.equal(dep.currentValue, '24.19.0-bookworm-slim');
  assert.match(dep.currentDigest, /^sha256:[a-f0-9]{64}$/);
});

test('native npm extraction discovers committed lock and exact dependency versions', async () => {
  const path = '.github/actions/semantic-release';
  mkdirSync(join(work, path), {recursive:true});
  for (const file of ['package.json', 'package-lock.json']) cpSync(`${path}/${file}`, join(work,path,file));
  const result = await npmExtract(read(`${path}/package.json`), `${path}/package.json`, {});
  assert.ok(result.deps.some(d => d.depName === 'semantic-release' && d.currentValue === '25.0.9'));
  assert.equal(result.managerData.npmLock, `${path}/package-lock.json`);
  const lock = JSON.parse(read(`${path}/package-lock.json`));
  assert.equal(lock.packages['node_modules/semantic-release'].version, '25.0.9');
  assert.ok(lock.packages['node_modules/semantic-release'].integrity);
});

test('native pip-compile links uv hash lock to its five exact input pins', async () => {
  const path = 'templates/generated-docs';
  mkdirSync(join(work,path), {recursive:true});
  for (const file of ['requirements.in','requirements.lock']) cpSync(`${path}/${file}`, join(work,path,file));
  const result = await pipExtract({}, [`${path}/requirements.lock`]);
  assert.equal(result.length, 1);
  assert.equal(result[0].packageFile, `${path}/requirements.in`);
  assert.equal(result[0].deps.filter(d => d.depType !== 'indirect').length, 5);
  assert.ok(result[0].deps.some(d => d.depName.toLowerCase() === 'click' && d.currentValue === '==8.3.1'));
  assert.match(JSON.stringify(result[0]), /requirements\.lock/);
  assert.match(read(`${path}/requirements.lock`), /--hash=sha256:/);
});

test('native pip-compile resolves the repository manual lock header to its input', async () => {
  const path = 'tools/manual';
  const header = read(`${path}/requirements.lock`);
  assert.match(header, /^# {4}uv pip compile tools\/manual\/requirements\.in --generate-hashes --output-file=tools\/manual\/requirements\.lock$/m);
  assert.doesNotMatch(header, /(^|\s)-o(\s|=)/);
  mkdirSync(join(work,path), {recursive:true});
  for (const file of ['requirements.in','requirements.lock']) cpSync(`${path}/${file}`, join(work,path,file));
  const result = await pipExtract({}, [`${path}/requirements.lock`]);
  assert.equal(result.length, 1);
  assert.equal(result[0].packageFile, `${path}/requirements.in`);
  assert.deepEqual(result[0].lockFiles, [`${path}/requirements.lock`]);
  assert.equal(result[0].deps.filter(d => d.depType !== 'indirect').length, 3);
  for (const [name, version] of [['zensical', '==0.0.73'], ['pytest', '==8.4.2'], ['playwright', '==1.64.1']]) {
    assert.ok(result[0].deps.some(d => d.depName.toLowerCase() === name && d.currentValue === version), name);
  }
});

test('file allowlist excludes history, nested Taskfiles and the fixtures themselves', () => {
  const matches = (patterns, path) => patterns.some(p => new RegExp(p.slice(1,-1)).test(path));
  for (const path of ['AGENTS.md', 'README.md', 'docs/dependency-pins.md']) assert.ok(matches(markdown.managerFilePatterns,path));
  for (const path of ['docs/adr/0002.md', 'docs/dependency-updates.md', 'tools/renovate/fixtures/AGENTS.md']) assert.ok(!matches(markdown.managerFilePatterns,path));
  assert.ok(matches(task.managerFilePatterns, 'Taskfile.yml'));
  assert.ok(!matches(task.managerFilePatterns, 'nested/Taskfile.yml'));
  assert.ok(preset.ignorePaths.includes('tools/renovate/fixtures/**'));
});

test('third-party Actions retain SHA integrity pins', async () => {
  const result = await actionsExtract(read('.github/workflows/generated-docs.yml'), '.github/workflows/generated-docs.yml', {});
  const dep = result.deps.find(d => d.depName === 'dorny/test-reporter');
  assert.equal(dep.currentDigest, '8861569aa5348397e7a26b6dda744c17c9265478');
  assert.equal(dep.currentValue, 'v2.1.1');
});

test('replacement reconciles stale display tag while preserving version-like path fragments', async () => {
  const input = fixture.replace('[Working guidelines v4.1.0]', '[Working guidelines v2.0.0]').replace('#move-work-forward', '#v4.1.0');
  const output = await update(input, 'AGENTS.md', markdown);
  assert.ok(output.includes('[Working guidelines v4.2.2]'));
  assert.ok(output.includes('/blob/v4.2.2/AGENTS.md#v4.1.0)'));
});

test('published Living Proof Labs dependencies are unscheduled; third parties keep Monday', async () => {
  const internal = preset.packageRules.at(-1);
  assert.equal(preset.packageRules[0].schedule, undefined);
  assert.deepEqual(internal.schedule, ['at any time']);
  assert.equal(internal.prHourlyLimit, 0);
  assert.equal(internal.prConcurrentLimit, 0);
  assert.equal(internal.branchConcurrentLimit, undefined);
  const resolved = (dep) => applyPackageRules({...preset, ...dep, packageName: dep.packageName ?? dep.depName}, 'test');
  const guidelines = await resolved({depName: 'Living-Proof-Labs/collaboration-guidelines', datasource: 'github-releases'});
  assert.equal(guidelines.groupName, 'collaboration guidelines');
  assert.deepEqual(guidelines.schedule, ['at any time']);
  assert.equal(guidelines.prHourlyLimit, 0);
  assert.equal(guidelines.prConcurrentLimit, 0);
  for (const depName of ['Living-Proof-Labs/some-action', 'living-proof-labs/some-action', 'ghcr.io/living-proof-labs/tooling', 'ghcr.io/living-proof-labs/nested/tooling', 'ghcr.io/Living-Proof-Labs/Tooling', '@living-proof-labs/sdk', '@Living-Proof-Labs/SDK']) {
    const rule = await resolved({depName});
    assert.deepEqual(rule.schedule, ['at any time'], depName);
    assert.equal(rule.prHourlyLimit, 0, depName);
    assert.equal(rule.prConcurrentLimit, 0, depName);
    assert.equal(rule.groupName, undefined, depName);
  }
  for (const sourceUrl of ['https://github.com/Living-Proof-Labs/livingproof-common', 'https://github.com/living-proof-labs/livingproof-common.git', 'https://github.com/Living-Proof-Labs/livingproof-common/tree/main']) {
    const rule = await resolved({depName: 'livingproof-common', sourceUrl});
    assert.deepEqual(rule.schedule, ['at any time'], sourceUrl);
    assert.equal(rule.prHourlyLimit, 0, sourceUrl);
  }
  for (const dep of [
    {depName: 'actions/checkout'},
    {depName: 'go-task/setup-task'},
    {depName: 'dorny/test-reporter'},
    {depName: 'actions/upload-artifact'},
    {depName: 'ghcr.io/astral-sh/uv', sourceUrl: 'https://github.com/astral-sh/uv'},
    {depName: 'python', sourceUrl: 'https://github.com/docker-library/python'},
    {depName: 'pytest', sourceUrl: 'https://github.com/pytest-dev/pytest'},
    {depName: 'jsonschema', sourceUrl: 'https://github.com/python-jsonschema/jsonschema'},
    {depName: 'ruff', sourceUrl: 'https://github.com/astral-sh/ruff'},
    {depName: 'Living-Proof-Labs-other/tool', sourceUrl: 'https://github.com/Living-Proof-Labs-other/tool'},
    {depName: 'ghcr.io/living-proof-labs-other/tool'},
    {depName: '@living-proof-labs-other/sdk', sourceUrl: 'https://github.com/other/sdk'},
  ]) {
    const rule = await resolved(dep);
    assert.deepEqual(rule.schedule, ['before 6am on monday'], dep.depName);
    assert.equal(rule.prHourlyLimit, 1, dep.depName);
    assert.equal(rule.prConcurrentLimit, 2, dep.depName);
  }
  const earlierMonday = {
    ...preset,
    packageRules: [
      {matchPackageNames: ['Living-Proof-Labs/collaboration-guidelines'], schedule: ['before 6am on monday']},
      ...preset.packageRules,
    ],
  };
  const cleared = await applyPackageRules({...earlierMonday, depName: 'Living-Proof-Labs/collaboration-guidelines', packageName: 'Living-Proof-Labs/collaboration-guidelines'}, 'test');
  assert.deepEqual(cleared.schedule, ['at any time']);
  const restored = await applyPackageRules({
    ...preset,
    packageRules: [
      ...preset.packageRules,
      {matchPackageNames: ['Living-Proof-Labs/collaboration-guidelines'], schedule: ['before 6am on monday']},
    ],
    depName: 'Living-Proof-Labs/collaboration-guidelines',
    packageName: 'Living-Proof-Labs/collaboration-guidelines',
  }, 'test');
  assert.deepEqual(restored.schedule, ['before 6am on monday']);
  counts.clear();
  setCount('HourlyPRs', 5);
  setCount('ConcurrentPRs', 5);
  setCount('Branches', 5);
  setCount('HourlyCommits', 0);
  const branch = (upgrade) => ({upgrades: [upgrade], isVulnerabilityAlert: false});
  assert.equal(calcLimit([guidelines], 'prHourlyLimit'), 0);
  assert.equal(calcLimit([guidelines], 'prConcurrentLimit'), 0);
  assert.equal(calcLimit([guidelines], 'branchConcurrentLimit'), 0);
  const third = await resolved({depName: 'pytest', sourceUrl: 'https://github.com/pytest-dev/pytest'});
  assert.equal(calcLimit([third], 'prHourlyLimit'), 1);
  assert.equal(calcLimit([third], 'prConcurrentLimit'), 2);
  assert.equal(calcLimit([third], 'branchConcurrentLimit'), 2);
  assert.equal(isLimitReached('Branches', branch(guidelines)), false);
  assert.equal(isLimitReached('Branches', branch(third)), true);
  counts.clear();
});

test('requires-python stays a range and other pep621 dependencies stay pinned', async () => {
  const pythonRule = preset.packageRules.at(-2);
  assert.equal(pythonRule.rangeStrategy, 'auto');
  assert.deepEqual(pythonRule.matchManagers, ['pep621']);
  assert.deepEqual(pythonRule.matchDepTypes, ['requires-python']);
  assert.equal(preset.packageRules.at(-1).schedule[0], 'at any time');
  assert.equal(preset.packageRules.at(-1).rangeStrategy, undefined);
  const resolved = (dep) => applyPackageRules({...preset, ...dep, packageName: dep.packageName ?? dep.depName}, 'test');
  const python = await resolved({manager: 'pep621', depType: 'requires-python', depName: 'python', currentValue: '>=3.11'});
  assert.equal(python.rangeStrategy, 'auto');
  assert.notEqual(python.rangeStrategy, 'pin');
  assert.deepEqual(python.schedule, ['before 6am on monday']);
  for (const dep of [
    {manager: 'pep621', depType: 'project.dependencies', depName: 'jsonschema', currentValue: '==4.25.1'},
    {manager: 'pep621', depType: 'dependency-groups', depName: 'pytest', currentValue: '==8.4.2'},
    {manager: 'pip-compile', depType: 'requires-python', depName: 'python', currentValue: '>=3.11'},
  ]) {
    const rule = await resolved(dep);
    assert.equal(rule.rangeStrategy, 'pin', dep.depName);
  }
  const internalRuntime = await resolved({
    manager: 'pep621',
    depType: 'requires-python',
    depName: 'python',
    currentValue: '>=3.11',
    sourceUrl: 'https://github.com/Living-Proof-Labs/livingproof-common',
  });
  assert.equal(internalRuntime.rangeStrategy, 'auto');
  assert.deepEqual(internalRuntime.schedule, ['at any time']);
  const internalPackage = await resolved({
    manager: 'pep621',
    depType: 'project.dependencies',
    depName: 'livingproof-common',
    sourceUrl: 'https://github.com/Living-Proof-Labs/livingproof-common',
  });
  assert.equal(internalPackage.rangeStrategy, 'pin');
  assert.deepEqual(internalPackage.schedule, ['at any time']);
});

test('replacement preserves blob-like segments in paths and fragments', async () => {
  for (const suffix of ['/docs/blob/v1.2.3/guide.md', '/AGENTS.md#example/blob/v1.2.3']) {
    const input = `<!-- renovate: guidelines -->\n[Guide v4.1.0](https://github.com/Living-Proof-Labs/collaboration-guidelines/blob/v4.1.0${suffix})\n`;
    assert.equal(await update(input, 'AGENTS.md', markdown), input.replaceAll('v4.1.0', 'v4.2.2'));
  }
});

test('native workflow replacement uses the same proposed release as documentation and Task', async () => {
  const input = 'jobs:\n  release:\n    uses: Living-Proof-Labs/collaboration-guidelines/.github/workflows/semantic-release.yml@v4.1.0\n';
  const file = '.github/workflows/release.yml';
  const result = await actionsExtract(input, file, {});
  const output = await doAutoReplace({...result.deps[0], manager: 'github-actions', packageFile:file, depIndex:0, newValue:'v4.2.2', autoReplaceGlobalMatch:true}, input, false);
  assert.equal(output, input.replace('v4.1.0', 'v4.2.2'));
});

});
