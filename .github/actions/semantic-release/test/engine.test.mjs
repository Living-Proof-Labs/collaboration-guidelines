// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import config from '../release.config.mjs';

test('real engine preserves consumer history, batches, previews and retries safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shared-release-'));
  const remote = join(root, 'origin.git');
  const cwd = join(root, 'consumer');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
  try {
    execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'pipe' });
    execFileSync('git', ['clone', remote, cwd], { stdio: 'pipe' });
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'test@example.invalid');
    const repositoryUrl = 'https://github.com/example/consumer';
    git('config', `url.file://${remote}.insteadOf`, repositoryUrl);
    git('commit', '--allow-empty', '-m', 'feat: existing consumer');
    git('tag', 'v1.0.0');
    git('push', 'origin', 'main', '--tags');
    const original = git('rev-parse', 'v1.0.0');
    // Only publication to GitHub is excluded: all version/notes/Git behavior is upstream.
    const options = { ...config, plugins: config.plugins.slice(0, 2), extends: [],
      ci: false, repositoryUrl };
    const env = { PATH: process.env.PATH, HOME: root, GIT_AUTHOR_NAME: 'Release Test',
      GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Release Test',
      GIT_COMMITTER_EMAIL: 'test@example.invalid' };
    const run = extra => semanticRelease({ ...options, ...extra }, { cwd, env, stdout: sink, stderr: sink });
    assert.equal(await run(), false);
    git('commit', '--allow-empty', '-m', 'docs: clarify examples');
    git('commit', '--allow-empty', '-m', 'chore: maintain dependencies');
    git('push', 'origin', 'main');
    const preview = await run({ dryRun: true });
    assert.equal(preview.nextRelease.version, '1.0.1');
    assert.equal(git('tag', '--list', 'v1.0.1'), '');
    const released = await run();
    assert.equal(released.nextRelease.version, '1.0.1');
    assert.equal(released.commits.length, 2);
    assert.ok(released.nextRelease.notes.includes('clarify examples'));
    assert.ok(released.nextRelease.notes.includes('maintain dependencies'));
    assert.equal(git('rev-parse', 'v1.0.1'), git('rev-parse', 'HEAD'));
    assert.equal(await run(), false);
    git('commit', '--allow-empty', '-m', 'feat: optional capability');
    git('push', 'origin', 'main');
    const failure = join(root, 'failure.cjs');
    await writeFile(failure, "exports.prepare = () => { throw new Error('test failure before tagging'); };\n");
    await assert.rejects(run({ plugins: [...options.plugins, failure] }), /test failure before tagging/);
    assert.equal(git('tag', '--list', 'v1.1.0'), '');
    assert.equal((await run()).nextRelease.version, '1.1.0');
    git('commit', '--allow-empty', '-m', 'feat!: replace contract');
    git('push', 'origin', 'main');
    assert.equal((await run()).nextRelease.version, '2.0.0');
    assert.equal(git('rev-parse', 'v1.0.0'), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
