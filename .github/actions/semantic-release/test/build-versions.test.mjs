// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPublishedReplay, run } from '../run.mjs';

const formats = outputs => [outputs['semver-version'], outputs['pep440-version'], outputs['debian-version']];
const stable = version => [version, version, version];
const repo = 'Living-Proof-Labs/example';
const path = `repos/${repo}`;
const release = tag => ({ tag_name: tag, published_at: '2026-11-21T20:00:00Z',
  draft: false, prerelease: false });

test('main build consumes one named version independently of writer failure or exact tag publication', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'main-build-versions-'));
  const before = { ...process.env };
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const write = (file, env = {}) => {
    Object.assign(process.env, {
      RELEASE_DRY_RUN: 'true', RELEASE_DRAFT: 'false', RELEASE_CANDIDATE: 'false', RELEASE_PLAN_ONLY: 'true',
      RELEASE_REPLAY_TAG: '', GITHUB_EVENT_NAME: 'push', GITHUB_OUTPUT: join(cwd, file), GITHUB_TOKEN: '',
      ...env,
    });
  };
  const read = async file => Object.fromEntries((await readFile(join(cwd, file), 'utf8'))
    .trimEnd().split('\n').map(line => line.split('=')));
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('commit', '--allow-empty', '-m', 'feat: already released');
    git('update-ref', 'refs/tags/v1.0.0', 'HEAD');
    git('commit', '--allow-empty', '-m', 'fix: needs a release');
    const head = git('rev-parse', 'HEAD');
    Object.assign(process.env, {
      GITHUB_WORKSPACE: cwd, GITHUB_REF: 'refs/heads/main', GITHUB_SHA: head,
      GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: repo,
      GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1',
    });
    const untouched = git('show-ref');
    const noWriter = async () => assert.fail('a read-only plan must not invoke the writer');
    write('planned');
    await run({ releaseEngine: noWriter });
    const planned = await read('planned');
    assert.equal(git('show-ref'), untouched);
    assert.equal(planned.commit, head);
    assert.equal(planned['run-id'], '12345');
    assert.equal(planned['run-attempt'], '1');
    assert.equal(planned.published, 'false');
    assert.deepEqual(formats(planned), stable('1.0.1'));
    assert.equal(planned.version, '1.0.1');
    assert.ok(!Object.hasOwn(planned, 'build-version'));

    // The consumer has no tag dependency or format-selection branch.
    const build = ({ 'semver-version': version, commit }) =>
      ({ label: `documentation-${version}`, commit });
    const built = build(planned);
    write('writer-failure', { RELEASE_DRY_RUN: 'false', RELEASE_PLAN_ONLY: 'false' });
    await assert.rejects(run({ releaseEngine: async () => { throw new Error('fixture writer failed'); } }),
      /fixture writer failed/);
    await assert.rejects(read('writer-failure'), { code: 'ENOENT' });
    assert.equal(git('show-ref'), untouched);
    write('planned-after-failure');
    await run({ releaseEngine: noWriter });
    assert.deepEqual(formats(await read('planned-after-failure')), formats(planned));

    // Model an exact tag appearing after the plan, without a network writer.
    git('update-ref', 'refs/tags/v1.0.1', head);
    const tagged = git('show-ref');
    write('regular-no-release', { GITHUB_RUN_ATTEMPT: '2' });
    await run({ releaseEngine: noWriter });
    const preview = await read('regular-no-release');
    assert.deepEqual(formats(preview),
      ['1.0.2-main.42.2', '1.0.2.dev420000000000000001234500000000000000000002', '1.0.2~main.42.2']);
    assert.equal(preview.version, '');
    assert.equal(preview['git-tag'], '');
    assert.equal(preview.published, 'false');

    write('exact-replay', { GITHUB_EVENT_NAME: 'workflow_dispatch', RELEASE_REPLAY_TAG: 'v1.0.1' });
    const responses = new Map([
      [`${path}/git/ref/heads/main`, { ref: 'refs/heads/main', object: { type: 'commit', sha: head } }],
      [`${path}/git/ref/tags/v1.0.1`, { ref: 'refs/tags/v1.0.1', object: { type: 'commit', sha: head } }],
      [`${path}/releases/tags/v1.0.1`, release('v1.0.1')],
    ]);
    const getReplay = (...args) => readPublishedReplay(...args, async endpoint => {
      assert.ok(responses.has(endpoint), endpoint);
      return responses.get(endpoint);
    });
    await run({ getReplay, releaseEngine: noWriter });
    const replay = await read('exact-replay');
    assert.deepEqual(formats(replay), formats(planned));
    assert.deepEqual(build(replay), built);
    assert.equal(replay['run-attempt'], '2');
    assert.equal(replay.published, 'false');
    assert.equal(replay['git-tag'], '');
    assert.equal(git('show-ref'), tagged);

    write('writer-token', { GITHUB_TOKEN: 'fixture-write-token' });
    await assert.rejects(run({ releaseEngine: noWriter }), /must not receive a release token/);
    write('missing-tag', { GITHUB_EVENT_NAME: 'workflow_dispatch' });
    await assert.rejects(run({ releaseEngine: noWriter }), /explicit main delivery retry/);
    write('invalid-title', { RELEASE_REPLAY_TAG: 'v1.0.1' });
    await assert.rejects(run({ releaseEngine: noWriter }), /explicit main delivery retry/);
    write('wrong-checkout', { GITHUB_EVENT_NAME: 'workflow_dispatch', RELEASE_REPLAY_TAG: 'v1.0.1',
      GITHUB_SHA: 'b'.repeat(40) });
    await assert.rejects(run({ getReplay, releaseEngine: noWriter }), /exact triggering commit/);
    write('malformed-run', { GITHUB_SHA: head, GITHUB_RUN_ATTEMPT: '01' });
    await assert.rejects(run({ getReplay, releaseEngine: noWriter }), /Invalid caller workflow run identity/);
    assert.equal(git('show-ref'), tagged);
  } finally {
    process.env = before;
    await rm(cwd, { recursive: true, force: true });
  }
});

test('published retry rejects partial writers, draft, stale and wrong refs; peels annotated tags', async () => {
  const commit = 'a'.repeat(40);
  const annotation = 'b'.repeat(40);
  const different = 'c'.repeat(40);
  const tag = 'v1.2.3';
  const answers = {
    'git/ref/heads/main': { ref: 'refs/heads/main', object: { type: 'commit', sha: commit } },
    'git/ref/tags/v1.2.3': { ref: 'refs/tags/v1.2.3', object: { type: 'tag', sha: annotation } },
    [`git/tags/${annotation}`]: { sha: annotation, object: { type: 'commit', sha: commit } },
    'releases/tags/v1.2.3': release(tag),
  };
  const resolve = (overrides = {}, selectedTag = tag) =>
    readPublishedReplay(repo, selectedTag, commit, async endpoint => {
      assert.ok(endpoint.startsWith(`${path}/`), endpoint);
      return { ...answers, ...overrides }[endpoint.slice(path.length + 1)];
    });
  assert.equal(await resolve(), '1.2.3');
  for (const [overrides, reason] of [
    [{ 'git/ref/heads/main': { ref: 'refs/heads/main', object: { type: 'commit', sha: different } } }, /current main/],
    [{ 'git/ref/tags/v1.2.3': undefined }, /fully qualified tag/],
    [{ 'git/ref/tags/v1.2.3': { ...answers['git/ref/tags/v1.2.3'], ref: 'refs/heads/v1.2.3' } }, /fully qualified tag/],
    [{ [`git/tags/${annotation}`]: { sha: annotation, object: { type: 'commit', sha: different } } }, /exact commit/],
    [{ 'releases/tags/v1.2.3': undefined }, /already published stable/],
    [{ 'releases/tags/v1.2.3': { ...release(tag), draft: true } }, /already published stable/],
    [{ 'releases/tags/v1.2.3': { ...release(tag), tag_name: 'v1.2.4' } }, /already published stable/],
  ]) await assert.rejects(resolve(overrides), reason);
  await assert.rejects(resolve({}, 'refs/tags/v1.2.3'), /stable tag/);
  await assert.rejects(readPublishedReplay('owner/..', tag, commit, () => assert.fail('invalid path')), /canonical repository/);
});
