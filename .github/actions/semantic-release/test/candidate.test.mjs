// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import config from '../release.config.mjs';
import { run, verifyTagMatchesCommit } from '../run.mjs';
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
      RELEASE_EXPECTED_COMMIT: first, RELEASE_EXPECTED_BASE: initial,
      GITHUB_WORKSPACE: cwd, GITHUB_OUTPUT: output,
      GITHUB_REF: 'refs/pull/1/merge', GITHUB_SHA: initial, GITHUB_TOKEN: '',
    });
    await run();
    assert.match(await readFile(output, 'utf8'), /version=1\.0\.0\ngit-tag=v1\.0\.0/);
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
      { commit: minor, version: '', gitTag: '' });
    const rerunOutput = join(cwd, 'candidate-rerun-output');
    Object.assign(process.env, { RELEASE_EXPECTED_COMMIT: minor, GITHUB_OUTPUT: rerunOutput });
    await run();
    assert.match(await readFile(rerunOutput, 'utf8'), /version=1\.1\.0\ngit-tag=v1\.1\.0/);
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
