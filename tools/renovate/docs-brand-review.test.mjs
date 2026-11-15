// SPDX-License-Identifier: Apache-2.0
// Review guards for the docs brand runner, run in pinned Renovate. Import this
// file from tools/renovate/test.mjs so its cases join the existing JUnit report.
import assert from 'node:assert/strict';
import {test, describe} from 'node:test';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {extractPackageFile as regexExtract} from '/usr/local/renovate/dist/modules/manager/custom/regex/index.js';
import {regEx} from '/usr/local/renovate/dist/util/regex.js';
import {matchRegexOrGlobList} from '/usr/local/renovate/dist/util/string-match.js';
import {applyPackageRules} from '/usr/local/renovate/dist/util/package-rules/index.js';
import {GlobalConfig} from '/usr/local/renovate/dist/config/global.js';
import {initRepo, getRepoStatus} from '/usr/local/renovate/dist/util/git/index.js';
import {postUpgradeCommandsExecutor} from '/usr/local/renovate/dist/workers/repository/update/branch/execute-post-upgrade-commands.js';
import {mergeRenovateConfig} from '/usr/local/renovate/dist/workers/repository/init/merge.js';
import {init} from '/usr/local/renovate/dist/logger/index.js';

await init();
const require = createRequire(import.meta.url);
const policy = (() => {
  const old = process.env.DOCS_BRAND_REPOSITORY;
  process.env.DOCS_BRAND_REPOSITORY = 'Living-Proof-Labs/fixture';
  try { return require('../docs-brand/runner.cjs'); }
  finally { if (old === undefined) delete process.env.DOCS_BRAND_REPOSITORY; else process.env.DOCS_BRAND_REPOSITORY = old; }
})();
const optIn = JSON.parse(readFileSync('renovate-docs-brand.json', 'utf8'));
const [manager] = policy.customManagers;
const lock = {repository: 'Living-Proof-Labs/collaboration-guidelines', version: 'v7.10.9', commit: 'c5fa9d9794d0ebd289f51b247fe7872de0db9c27', path: 'brand/docs/brand.css', sha256: 'd62706445615a9de9dfa743872010b6d1d55e7d05b64764dd7f02a068dff4c54'};
const command = optIn.packageRules[0].postUpgradeTasks.commands[0];
const renovateAllows = cmd => policy.allowedCommands.some(pattern => regEx(pattern).test(cmd));

describe('Docs brand runner review (pinned Renovate)', () => {
  test('Renovate allowedCommands matching admits only the fixed helper command', () => {
    assert.equal(renovateAllows(command), true);
    for (const cmd of [`${command}; id`, `${command} && id`, `${command}\nid`, `${command} --check`, 'node /opt/docs-brand/lock.mjs --check',
      'node /tmp/lock.mjs --update', 'node /opt/docs-brand/lock_mjs --update', `sh -c '${command}'`]) assert.equal(renovateAllows(cmd), false, cmd);
  });
  test('the post-upgrade command is a constant with no template data from dependency metadata', () => {
    assert.doesNotMatch(command, /\{\{|\}\}|\$/);
    assert.equal(optIn.packageRules[0].postUpgradeTasks.dataFileTemplate, undefined);
    assert.equal(optIn.packageRules[0].postUpgradeTasks.workingDirTemplate, undefined);
    assert.equal(optIn.packageRules[0].postUpgradeTasks.installTools, undefined);
  });
  test('only the root lock file is managed; nested, renamed and look-alike paths are not', () => {
    assert.equal(matchRegexOrGlobList('docs-brand.lock.json', manager.managerFilePatterns), true);
    for (const path of ['docs/docs-brand.lock.json', 'a/docs-brand.lock.json', 'docs-brand.lock.json.bak', 'xdocs-brand.lock.json', 'docs-brand.lock.jsonx', '.github/docs-brand.lock.json'])
      assert.equal(matchRegexOrGlobList(path, manager.managerFilePatterns), false, path);
  });
  test('extraction finds the version in written and compact locks; only version is replaced', () => {
    for (const content of [JSON.stringify(lock, null, 2) + '\n', JSON.stringify(lock)]) {
      const result = regexExtract(content, 'docs-brand.lock.json', manager);
      assert.equal(result.deps.length, 1);
      assert.equal(result.deps[0].currentValue, 'v7.10.9');
      assert.equal(result.deps[0].depType, 'docs-brand');
      assert.doesNotMatch(result.deps[0].replaceString, /commit|sha256|path/);
    }
  });
  test('reordered, foreign or unstable locks are not extracted (fail to no update, not to a guess)', () => {
    const reordered = JSON.stringify({version: lock.version, repository: lock.repository, commit: lock.commit, path: lock.path, sha256: lock.sha256}, null, 2);
    assert.equal(regexExtract(reordered, 'docs-brand.lock.json', manager), null);
    assert.equal(regexExtract(JSON.stringify({...lock, repository: 'attacker/collaboration-guidelines'}), 'docs-brand.lock.json', manager), null);
    for (const version of ['v7.10.9-rc.1', 'main', 'v7', '7.10.9']) assert.equal(regexExtract(JSON.stringify({...lock, version}), 'docs-brand.lock.json', manager), null, version);
  });
  test('runner package rules enable the brand dependency with the helper and never automerge', async () => {
    const dep = regexExtract(JSON.stringify(lock), 'docs-brand.lock.json', manager).deps[0];
    const rule = await applyPackageRules({...policy, ...dep, packageName: dep.depName}, 'test');
    assert.equal(rule.enabled, true);
    assert.equal(rule.automerge, false);
    assert.equal(rule.platformAutomerge, false);
    assert.deepEqual(rule.postUpgradeTasks.fileFilters, ['docs-brand.lock.json']);
    assert.equal(rule.allowedVersions, '/^v[0-9]+\\.[0-9]+\\.[0-9]+$/');
  });
  test('consumer config cannot add managers, files, commands or automerge under the production merge', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-review-merge-'));
    writeFileSync(join(dir, 'docs-brand.lock.json'), JSON.stringify(lock));
    writeFileSync(join(dir, 'renovate.json'), JSON.stringify({
      customManagers: [{customType: 'regex', managerFilePatterns: ['/.*/'], matchStrings: ['(?<currentValue>.*)'], depNameTemplate: 'x', datasourceTemplate: 'npm'}],
      packageRules: [{matchPackageNames: ['*'], automerge: true, postUpgradeTasks: {commands: ['id'], fileFilters: ['**/*']}}],
      branchPrefix: 'main', baseBranchPatterns: ['release'], ignorePaths: [], enabledManagers: ['github-actions', 'custom.regex'],
    }));
    const saved = {...GlobalConfig.get()};
    GlobalConfig.set({...policy, localDir: dir});
    try {
      const merged = await mergeRenovateConfig({...policy, repository: 'Living-Proof-Labs/fixture'});
      assert.deepEqual(merged.customManagers, policy.customManagers);
      assert.deepEqual(merged.enabledManagers, ['custom.regex']);
      assert.equal(merged.branchPrefix, 'renovate-docs-brand/');
      assert.equal(merged.baseBranchPatterns, undefined);
      assert.equal(JSON.stringify(merged.packageRules).includes('"id"'), false);
      assert.equal(merged.automerge, false);
    } finally { GlobalConfig.set(saved); }
  });
  test('an allowed but failing helper is reported as an artifact error and leaves a version-only proposal', async () => {
    // Production command and allow-list; /opt/docs-brand is not mounted in this test runtime.
    const origin = mkdtempSync(join(tmpdir(), 'brand-review-origin-'));
    const git = args => execFileSync('git', args, {cwd: origin, stdio: 'pipe'});
    git(['init', '-q']);
    writeFileSync(join(origin, 'docs-brand.lock.json'), JSON.stringify(lock));
    git(['add', '.']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'baseline']);
    const checkout = mkdtempSync(join(tmpdir(), 'brand-review-checkout-'));
    const saved = {...GlobalConfig.get()};
    GlobalConfig.set({localDir: checkout, cacheDir: join(origin, 'cache'), binarySource: 'global',
      allowShellExecutorForPostUpgradeCommands: false, allowedCommands: policy.allowedCommands});
    await initRepo({url: origin});
    await getRepoStatus();
    const proposed = JSON.stringify({...lock, version: 'v9.2.0'});
    let result;
    try { result = await postUpgradeCommandsExecutor([{depName: lock.repository, packageFile: 'docs-brand.lock.json', postUpgradeTasks: optIn.packageRules[0].postUpgradeTasks}],
      {updatedPackageFiles: [{type: 'addition', path: 'docs-brand.lock.json', contents: proposed}], updatedArtifacts: []}); }
    finally { GlobalConfig.set(saved); }
    assert.equal(result.artifactErrors.length, 1);
    assert.doesNotMatch(result.artifactErrors[0].stderr, /allowed list/);
    // Renovate still collects the modified lock: the branch would carry the version-only file.
    assert.deepEqual(result.updatedArtifacts.map(a => a.path), ['docs-brand.lock.json']);
    assert.equal(JSON.parse(result.updatedArtifacts[0].contents.toString()).commit, lock.commit);
    const left = JSON.parse(readFileSync(join(checkout, 'docs-brand.lock.json'), 'utf8'));
    assert.equal(left.version, 'v9.2.0');
    assert.equal(left.commit, lock.commit, 'consumer CI must reject this version-only state');
  });
});
