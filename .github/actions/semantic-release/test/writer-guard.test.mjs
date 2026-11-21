// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import { run } from '../run.mjs';

test('writer accepts only the sealed version and commit even when a release tag arrives late', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sealed-writer-'));
  const remote = join(root, 'remote.git');
  const cwd = join(root, 'consumer');
  const dryCwd = join(root, 'stale-consumer');
  const saved = { ...process.env };
  const repositoryUrl = 'https://github.example.invalid/example/consumer.git';
  const gitEnv = { GIT_ALLOW_PROTOCOL: 'file', PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Release Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Release Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  const gitAt = (cwd, ...args) => execFileSync('git', args, {
    cwd, env: gitEnv, encoding: 'utf8', stdio: 'pipe',
  }).trim();
  const git = (...args) => gitAt(cwd, ...args);
  const refs = () => gitAt(remote, 'show-ref');
  const noEngine = async () => assert.fail('must refuse before invoking the writer');
  const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });

  try {
    gitAt(root, 'init', '--bare', '--initial-branch=main', remote);
    gitAt(root, 'clone', remote, cwd);
    git('commit', '--allow-empty', '-m', 'feat: initial release');
    git('update-ref', 'refs/tags/v1.0.0', 'HEAD');
    git('commit', '--allow-empty', '-m', 'feat: release A');
    const a = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'fix: release B');
    const b = git('rev-parse', 'HEAD');
    git('push', 'origin', 'main', '--tags'); // Test fixture, file-backed remote only.
    gitAt(root, 'clone', remote, dryCwd);
    for (const checkout of [cwd, dryCwd]) {
      gitAt(checkout, 'config', `url.file://${remote}.insteadOf`, repositoryUrl);
    }

    const setup = (file, overrides = {}) => {
      process.env = {
        ...gitEnv, RELEASE_DRY_RUN: 'true', GITHUB_REF: 'refs/heads/main',
        GITHUB_WORKSPACE: cwd, GITHUB_SHA: b, GITHUB_OUTPUT: join(root, file),
        GITHUB_SERVER_URL: 'https://github.example.invalid', GITHUB_REPOSITORY: 'example/consumer',
        RELEASE_WRITER_EXPECTED_VERSION: '1.1.0', RELEASE_WRITER_EXPECTED_COMMIT: b, ...overrides,
      };
    };
    const output = async file => Object.fromEntries((await readFile(join(root, file), 'utf8'))
      .trimEnd().split('\n').map(line => line.split('=')));
    const absent = file => assert.rejects(output(file), { code: 'ENOENT' });
    const stopAtPrepare = join(root, 'stop-at-prepare.cjs');
    await writeFile(stopAtPrepare, "exports.prepare = () => { throw new Error('fixture prevents tagging'); };\n");
    const actualEngine = (options, context) => {
      // No GitHub plugin or remote transport; use the locked engine and actual
      // adapter-selected verification plugin against only the file-backed Git repo.
      const plugins = options.plugins.filter((_, index) => index !== 2);
      if (!options.dryRun) plugins.push(stopAtPrepare);
      return semanticRelease({ ...options, plugins, repositoryUrl, ci: false },
        { ...context, stdout: sink, stderr: sink, env: { ...gitEnv } });
    };

    const initialRefs = refs();
    setup('sealed', {
      RELEASE_PLAN_ONLY: 'true', RELEASE_WRITER_EXPECTED_VERSION: '', RELEASE_WRITER_EXPECTED_COMMIT: '',
      GITHUB_EVENT_NAME: 'push', GITHUB_RUN_NUMBER: '17', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1',
    });
    await run({ releaseEngine: noEngine });
    assert.equal((await output('sealed'))['semver-version'], '1.1.0');
    assert.equal((await output('sealed')).commit, b);

    for (const [overrides, reason] of [
      [{ RELEASE_WRITER_EXPECTED_VERSION: '' }, /provide both/],
      [{ RELEASE_WRITER_EXPECTED_COMMIT: '' }, /provide both/],
      [{ RELEASE_WRITER_EXPECTED_VERSION: '1.1.0-pr.1.17.1' }, /stable version/],
      [{ RELEASE_WRITER_EXPECTED_VERSION: 'v1.1.0' }, /stable version/],
      [{ RELEASE_WRITER_EXPECTED_COMMIT: b.slice(0, 7) }, /full lowercase commit SHA/],
      [{ RELEASE_WRITER_EXPECTED_COMMIT: b + '\n' }, /full lowercase commit SHA/],
      [{ RELEASE_WRITER_EXPECTED_COMMIT: a }, /does not match triggering commit/],
      [{ GITHUB_SHA: a, RELEASE_WRITER_EXPECTED_COMMIT: a }, /Checked-out HEAD/],
      [{ RELEASE_PLAN_ONLY: 'true' }, /Only the release writer/],
    ]) {
      setup('bad-input', overrides);
      await assert.rejects(run({ releaseEngine: noEngine }), reason);
      await absent('bad-input');
    }

    setup('matched');
    await run({ releaseEngine: actualEngine });
    assert.deepEqual(await output('matched'), { published: 'false', 'draft-created': 'false',
      version: '1.1.0', 'git-tag': 'v1.1.0', 'release-url': '', commit: b });
    setup('engine-no-release');
    await assert.rejects(run({ releaseEngine: async () => false }), /did not select expected release/);
    await absent('engine-no-release');
    assert.equal(refs(), initialRefs);

    // Earlier A completes and creates its stable tag after B sealed its artifact.
    gitAt(remote, 'update-ref', 'refs/tags/v1.1.0', a);
    const afterA = refs();
    git('fetch', '--tags', 'origin');
    setup('fresh-mismatch', { RELEASE_DRY_RUN: 'false' });
    await assert.rejects(run({ releaseEngine: noEngine }), /plan is 1\.1\.1 .* expected 1\.1\.0/);
    await absent('fresh-mismatch');

    // If the writer checkout also predates A's tag, the adapter preflight still
    // matches B's seal. The actual engine fetch sees A's tag and must fail at
    // verifyRelease before it can tag or publish a differently versioned B.
    assert.equal(gitAt(dryCwd, 'tag', '--list', 'v1.1.0'), '');
    setup('engine-mismatch', { GITHUB_WORKSPACE: dryCwd, RELEASE_DRY_RUN: 'false' });
    await assert.rejects(run({ releaseEngine: actualEngine }), /disagrees.*expected v1\.1\.0 .* got v1\.1\.1/);
    await absent('engine-mismatch');
    assert.equal(gitAt(dryCwd, 'tag', '--list', 'v1.1.1'), '');
    assert.equal(refs(), afterA);

    setup('legacy', { RELEASE_WRITER_EXPECTED_VERSION: '', RELEASE_WRITER_EXPECTED_COMMIT: '' });
    await run({ releaseEngine: actualEngine });
    assert.equal((await output('legacy')).version, '1.1.1');
    assert.equal((await output('legacy')).commit, b);
    assert.equal(refs(), afterA);
    git('update-ref', 'refs/tags/v1.1.1', b);
    setup('fresh-no-release', { RELEASE_WRITER_EXPECTED_VERSION: '1.1.1', RELEASE_DRY_RUN: 'false' });
    await assert.rejects(run({ releaseEngine: noEngine }), /No release is due/);
    await absent('fresh-no-release');
    setup('legacy-no-release', { RELEASE_WRITER_EXPECTED_VERSION: '', RELEASE_WRITER_EXPECTED_COMMIT: '' });
    await run({ releaseEngine: async () => false });
    assert.equal((await output('legacy-no-release')).published, 'false');
    assert.equal((await output('legacy-no-release')).version, '');
    assert.equal(refs(), afterA);
  } finally {
    process.env = saved;
    await rm(root, { recursive: true, force: true });
  }
});
