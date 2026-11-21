// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import semver from 'semver';
import config from '../release.config.mjs';
import { candidateBuildVersions, run, verifyTagMatchesCommit } from '../run.mjs';
import { planVersion } from '../plan.mjs';
import { verifyRelease } from '../verify-plan.mjs';

test('detached candidate uses canonical history without a remote write path', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'release-candidate-'));
  const saved = { ...process.env };
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const head = () => git('rev-parse', 'HEAD');
  const commit = (message) => { git('commit', '--allow-empty', '-m', message); return head(); };
  const tagFixture = (version, revision) => git('update-ref', 'refs/tags/v' + version, revision);
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('remote', 'add', 'origin', join(cwd, 'unavailable.git'));
    const initial = commit('feat: initial');
    const plan = () => planVersion(cwd, head(), { candidate: true, expectedBase: initial });
    git('update-ref', 'refs/remotes/origin/main', initial);
    git('checkout', '--detach', initial);
    const first = commit('fix: first patch');
    const refs = () => git('show-ref');
    const before = refs();
    const output = join(cwd, 'candidate-output');
    Object.assign(process.env, {
      RELEASE_DRY_RUN: 'true', RELEASE_DRAFT: 'false', RELEASE_CANDIDATE: 'true',
      RELEASE_EXPECTED_COMMIT: first, RELEASE_EXPECTED_BASE: initial, RELEASE_PR_NUMBER: '131',
      GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1',
      GITHUB_WORKSPACE: cwd, GITHUB_OUTPUT: output,
      GITHUB_REF: 'refs/pull/1/merge', GITHUB_SHA: initial, GITHUB_TOKEN: '',
    });
    await run();
    assert.match(await readFile(output, 'utf8'), /version=1\.0\.0\ngit-tag=v1\.0\.0/);
    assert.match(await readFile(output, 'utf8'), /semver-version=1\.0\.0-pr\.131\.42\.1\n/);
    assert.equal(refs(), before);
    await assert.rejects(planVersion(cwd, initial, { candidate: true, expectedBase: initial }), /triggering commit/);
    await assert.rejects(planVersion(cwd, first, { candidate: true }), /exact PR event base/);
    await assert.rejects(planVersion(cwd, first, { candidate: true, expectedBase: first }), /not reachable/);
    tagFixture('1.0.0', initial);
    assert.equal((await plan()).version, '1.0.1');
    // The candidate's own tag must not manufacture a main baseline.
    tagFixture('9.0.0', first);
    assert.equal((await plan()).version, '1.0.1');
    const minor = commit('feat: next');
    const candidate = await plan();
    assert.equal(candidate.version, '1.1.0');
    // Same history and inputs use the writer's identical plan, before adding the
    // candidate-only synthetic tag to canonical main; remove only this fixture ref.
    git('update-ref', '-d', 'refs/tags/v9.0.0');
    assert.deepEqual(await planVersion(cwd, minor), candidate);
    verifyRelease(candidate, { nextRelease: { version: candidate.version, gitTag: candidate.gitTag, gitHead: minor } });
    assert.throws(() => verifyRelease(candidate, { nextRelease: { ...candidate, gitHead: initial } }), /disagrees/);
    git('checkout', '--detach', initial);
    assert.deepEqual(await plan(), { commit: initial, version: '', gitTag: '' });
    git('checkout', '--detach', minor);
    commit('feat!: changed merge history');
    assert.equal((await plan()).version, '2.0.0');
    verifyTagMatchesCommit('v1.0.0', initial, { cwd, fetchTag: false });
    assert.throws(() => verifyTagMatchesCommit('v1.0.0', minor, { cwd, fetchTag: false }), /expected/);
    assert.throws(() => verifyTagMatchesCommit('v2.0.0', minor, { cwd, fetchTag: false }));

    // A rerun of the same PR event must still plan against the original base,
    // even if main already incorporated and released the exact candidate.
    git('checkout', '--detach', minor);
    tagFixture('1.1.0', minor);
    const advancedMain = commit('fix: later change on main');
    git('update-ref', 'refs/remotes/origin/main', advancedMain);
    git('checkout', '--detach', minor);
    assert.deepEqual(await plan(), candidate);
    assert.deepEqual(await planVersion(cwd, minor, { candidate: true, expectedBase: advancedMain }),
      { commit: minor, version: '1.1.1', gitTag: 'v1.1.1' });
    tagFixture('1.1.1', advancedMain);
    assert.deepEqual(await planVersion(cwd, minor, { candidate: true, expectedBase: advancedMain }),
      { commit: minor, version: '', gitTag: '' });
    const rerunOutput = join(cwd, 'candidate-rerun-output');
    Object.assign(process.env, { RELEASE_EXPECTED_COMMIT: minor, GITHUB_OUTPUT: rerunOutput,
      GITHUB_RUN_ATTEMPT: '2' });
    await run();
    assert.match(await readFile(rerunOutput, 'utf8'), /version=1\.1\.0\ngit-tag=v1\.1\.0/);
    assert.match(await readFile(rerunOutput, 'utf8'), /semver-version=1\.1\.0-pr\.131\.42\.2\n/);
  } finally {
    process.env = saved;
    await rm(cwd, { recursive: true, force: true });
  }
});

test('detached candidate matches the locked main engine for skipped commits and a stable metadata tag', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-parity-'));
  const remote = join(root, 'origin.git');
  const cwd = join(root, 'consumer');
  const env = {
    PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  const gitAt = (location, ...args) => execFileSync('git', args, {
    cwd: location, env, encoding: 'utf8', stdio: 'pipe',
  }).trim();
  const git = (...args) => gitAt(cwd, ...args);
  const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
  try {
    gitAt(root, 'init', '--bare', '--initial-branch=main', remote);
    gitAt(root, 'clone', remote, cwd);
    git('commit', '--allow-empty', '-m', 'feat: stable baseline');
    git('update-ref', 'refs/tags/v1.0.0+historic', 'HEAD');
    git('update-ref', 'refs/tags/v2.0.0-rc.1', 'HEAD');
    git('push', 'origin', 'main', '--tags'); // Disposable local fixture only.
    const baseline = git('rev-parse', 'HEAD');
    let eventBase = baseline;
    for (const [messages, expected] of [
      [['feat!: skipped [skip release]', 'feat: skipped in body\n\n[ReLeAsE   SkIp]'], ''],
      [['fix: ordinary patch'], '1.0.1'],
    ]) {
      git('checkout', '--detach', 'main');
      for (const message of messages) git('commit', '--allow-empty', '-m', message);
      const head = git('rev-parse', 'HEAD');
      const candidate = await planVersion(cwd, head, { candidate: true, expectedBase: eventBase });
      git('branch', '-f', 'main', head);
      git('checkout', 'main');
      git('push', 'origin', 'main');
      const localRefs = git('show-ref');
      const remoteRefs = gitAt(remote, 'show-ref');
      // Use the actual locked engine preprocessing and analyzer, but no publication
      // plugin, GitHub endpoint, token, or persistent repository.
      const engine = await semanticRelease({
        ...config, plugins: config.plugins.slice(0, 1),
        ci: false, dryRun: true, extends: [], repositoryUrl: remote,
      }, { cwd, env, stdout: sink, stderr: sink });
      assert.equal(candidate.version, expected);
      assert.equal(engine?.nextRelease?.version ?? '', expected);
      assert.equal(engine?.nextRelease?.gitTag ?? '', candidate.gitTag);
      if (engine) assert.equal(engine.nextRelease.gitHead, candidate.commit);
      assert.equal(git('show-ref'), localRefs);
      assert.equal(gitAt(remote, 'show-ref'), remoteRefs);
      eventBase = head;
    }
    assert.equal(git('rev-parse', 'refs/tags/v1.0.0+historic'), baseline);
    git('update-ref', 'refs/tags/v=3.0.0', baseline);
    const head = git('rev-parse', 'HEAD');
    await assert.rejects(planVersion(cwd, head, { candidate: true, expectedBase: eventBase }),
      /Unsupported release baseline tag/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('branch artifact version advances across runs and an intervening main release', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'branch-artifact-version-'));
  const saved = { ...process.env };
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const commit = message => { git('commit', '--allow-empty', '-m', message); return git('rev-parse', 'HEAD'); };
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('remote', 'add', 'origin', join(cwd, 'unavailable.git'));
    const emptyReleaseBase = commit('Initial baseline without release intent');
    git('update-ref', 'refs/remotes/origin/main', emptyReleaseBase);
    const candidateOutput = async (head, base, build, attempt = '1', pr = '131') => {
      const output = join(cwd, `fixture-${build}-${attempt}.txt`);
      Object.assign(process.env, {
        RELEASE_DRY_RUN: 'true', RELEASE_DRAFT: 'false', RELEASE_CANDIDATE: 'true',
        RELEASE_EXPECTED_COMMIT: head, RELEASE_EXPECTED_BASE: base, RELEASE_PR_NUMBER: pr,
        GITHUB_OUTPUT: output, GITHUB_WORKSPACE: cwd, GITHUB_REF: 'refs/pull/131/merge',
        GITHUB_RUN_NUMBER: build, GITHUB_RUN_ID: `126${build}`, GITHUB_RUN_ATTEMPT: attempt, GITHUB_TOKEN: '',
      });
      await run();
      const readout = Object.fromEntries((await readFile(output, 'utf8')).trimEnd()
        .split('\n').map(line => line.split('=')));
      assert.equal(readout.commit, head);
      assert.equal(readout.published, 'false');
      assert.equal(readout['draft-created'], 'false');
      assert.equal(readout['release-url'], '');
      return readout;
    };
    const notDue = await candidateOutput(emptyReleaseBase, emptyReleaseBase, '8');
    assert.equal(notDue.version, '');
    assert.equal(notDue['git-tag'], '');
    assert.equal(notDue['semver-version'], '1.0.0-pr.131.8.1');

    const baseline = commit('feat: stable baseline');
    git('update-ref', 'refs/tags/v9.7.9', baseline);
    git('update-ref', 'refs/remotes/origin/main', baseline);
    const noRelease = await candidateOutput(baseline, baseline, '9');
    assert.equal(noRelease.version, '');
    assert.equal(noRelease['git-tag'], '');
    assert.equal(noRelease['semver-version'], '9.7.10-pr.131.9.1');

    git('checkout', '--detach', baseline);
    const head = commit('feat: same PR feature');
    const first = await candidateOutput(head, baseline, '42');
    const second = await candidateOutput(head, baseline, '43');
    assert.equal(first['semver-version'], '9.8.0-pr.131.42.1');
    assert.equal(second['semver-version'], '9.8.0-pr.131.43.1');

    git('checkout', 'main');
    const mainRelease = commit('feat: a different release on main');
    git('update-ref', 'refs/tags/v9.8.0', mainRelease);
    git('update-ref', 'refs/remotes/origin/main', mainRelease);
    git('checkout', '--detach', head);
    assert.notEqual(git('merge-base', mainRelease, head), mainRelease);
    const refs = git('show-ref');
    const third = await candidateOutput(head, mainRelease, '44');
    assert.equal(third.version, '9.9.0');
    assert.equal(third['git-tag'], 'v9.9.0');
    assert.equal(third['semver-version'], '9.9.0-pr.131.44.1');
    assert.equal(third['pep440-version'], '9.9.0.dev440000000000000001264400000000000000000001');
    assert.equal(third['debian-version'], '9.9.0~pr.131.44.1');
    assert.ok(semver.lt(first['semver-version'], second['semver-version']));
    assert.ok(semver.lt(second['semver-version'], third['semver-version']));
    const retry = await candidateOutput(head, baseline, '42', '2');
    assert.equal(retry.version, first.version);
    assert.equal(retry['git-tag'], first['git-tag']);
    assert.equal(retry.commit, first.commit);
    assert.equal(retry['semver-version'], '9.8.0-pr.131.42.2');
    assert.ok(semver.lt(first['semver-version'], retry['semver-version']));
    assert.ok(semver.lt(retry['semver-version'], second['semver-version']));
    assert.notEqual(first['pep440-version'], retry['pep440-version']);
    assert.notEqual(first['debian-version'], retry['debian-version']);
    assert.equal(git('show-ref'), refs);
    await assert.rejects(candidateOutput(head, baseline, '045'), /caller workflow run identity/);
    await assert.rejects(candidateOutput(head, baseline, '45', '1', '131\nextra=1'), /PR number/);
    await assert.rejects(readFile(join(cwd, 'fixture-45-1.txt')), { code: 'ENOENT' });
  } finally {
    process.env = saved;
    await rm(cwd, { recursive: true, force: true });
  }
});

test('artifact precedence is numeric and untrusted identifiers fail closed', () => {
  const first = candidateBuildVersions('9.8.0', '131', '9', '98765', '9');
  const second = candidateBuildVersions('9.8.0', '131', '10', '15', '1');
  const otherWorkflow = candidateBuildVersions('9.8.0', '131', '10', '16', '1');
  assert.ok(semver.lt(first['semver-version'], second['semver-version']));
  assert.ok(semver.lt(second['semver-version'], '9.8.0'));
  assert.ok(BigInt(first['pep440-version'].split('.dev')[1]) < BigInt(second['pep440-version'].split('.dev')[1]));
  assert.notEqual(second['pep440-version'], otherWorkflow['pep440-version']);
  assert.equal(first['debian-version'], '9.8.0~pr.131.9.9');
  assert.equal(second['debian-version'], '9.8.0~pr.131.10.1');
  assert.notEqual(second['semver-version'], candidateBuildVersions('9.8.0', '132', '10', '17', '1')['semver-version']);
  for (const args of [
    ['9.8.0', '131', '09', '1'], ['9.8.0', '0', '9', '1'], ['9.8.0', '', '9', '1'],
    ['9.8.0', '131', undefined, '1'], ['9.8.0', '131', '9', undefined],
    ['9.8.0', '131', '9\n', '1'], ['9.8.0', '131\n', '9', '1'], ['9.8.0\n', '131', '9', '1'],
    ['09.8.0', '131', '9', '1'], ['9.8.0-rc.1', '131', '9', '1'], ['9.8.0+metadata', '131', '9', '1'],
    ['9.8.0', '131', '9', '0001'], ['9.8.0', '131', '9', '1'.repeat(21)],
  ]) assert.throws(() => candidateBuildVersions(...args, '1'), /stable base|Invalid preview|Invalid PR number/);
  for (const attempt of [undefined, '', '0', '01', '1\n', '1'.repeat(21)]) {
    assert.throws(() => candidateBuildVersions('9.8.0', '131', '10', '15', attempt), /run ID and attempt/);
  }
});


test('late tag on the same PR event base never reuses an earlier attempt identity', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'branch-late-base-tag-'));
  const saved = { ...process.env };
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const commit = message => { git('commit', '--allow-empty', '-m', message); return git('rev-parse', 'HEAD'); };
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('remote', 'add', 'origin', join(cwd, 'unavailable.git'));
    const lastRelease = commit('feat: released baseline');
    git('update-ref', 'refs/tags/v1.0.0', lastRelease);
    const eventBase = commit('feat: release not tagged yet');
    git('update-ref', 'refs/remotes/origin/main', eventBase);
    git('checkout', '--detach', eventBase);
    const prHead = commit('fix: PR change');
    Object.assign(process.env, {
      RELEASE_DRY_RUN: 'true', RELEASE_DRAFT: 'false', RELEASE_CANDIDATE: 'true',
      RELEASE_EXPECTED_COMMIT: prHead, RELEASE_EXPECTED_BASE: eventBase, RELEASE_PR_NUMBER: '131',
      GITHUB_WORKSPACE: cwd, GITHUB_REF: 'refs/pull/131/merge', GITHUB_TOKEN: '',
      GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ID: '12345678',
    });

    const attempt = async n => {
      const output = join(cwd, `same-event-attempt-${n}.txt`);
      Object.assign(process.env, { GITHUB_OUTPUT: output, GITHUB_RUN_ATTEMPT: n });
      const refs = git('show-ref');
      await run();
      assert.equal(git('show-ref'), refs);
      const values = Object.fromEntries((await readFile(output, 'utf8')).trimEnd()
        .split('\n').map(line => line.split('=')));
      assert.equal(values.commit, prHead);
      assert.equal(values.published, 'false');
      assert.equal(values['draft-created'], 'false');
      assert.equal(values['release-url'], '');
      return values;
    };
    const first = await attempt('1');
    assert.equal(first.version, '1.1.0');
    assert.equal(first['semver-version'], '1.1.0-pr.131.42.1');

    // A fixture-only tag models a release finishing after the candidate was built.
    // Same event base, head, PR, run number and run ID on the retry.
    git('update-ref', 'refs/tags/v1.1.0', eventBase);
    const second = await attempt('2');
    assert.equal(second.version, '1.1.1');
    assert.equal(second['semver-version'], '1.1.1-pr.131.42.2');
    const third = await attempt('3');
    assert.equal(third.version, second.version);
    assert.equal(third['semver-version'], '1.1.1-pr.131.42.3');
    for (const k of ['semver-version', 'pep440-version', 'debian-version']) {
      assert.equal(new Set([first[k], second[k], third[k]]).size, 3);
    }
  } finally {
    process.env = saved;
    await rm(cwd, { recursive: true, force: true });
  }
});
