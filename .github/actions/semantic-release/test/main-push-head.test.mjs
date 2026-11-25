// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { run } from '../run.mjs';
import { planVersion } from '../plan.mjs';

const triggeringCommit = { message: 'Checked-out HEAD must match the triggering commit' };

function gitIn(cwd) {
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: 'pipe',
  }).trim();
  const commit = message => {
    git('commit', '--allow-empty', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  return { git, commit };
}

function prepare(cwd, objectFormat) {
  const tools = gitIn(cwd);
  const args = ['init', '--initial-branch=main'];
  if (objectFormat) args.push(`--object-format=${objectFormat}`);
  tools.git(...args);
  tools.git('config', 'user.name', 'Fixture');
  tools.git('config', 'user.email', 'fixture@example.invalid');
  return tools;
}

test('non-candidate planVersion refuses a triggering commit other than checked-out HEAD', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'main-push-head-'));
  try {
    const { commit } = prepare(cwd);
    const head = commit('feat: initial');
    const other = 'a'.repeat(40) === head ? 'b'.repeat(40) : 'a'.repeat(40);
    assert.equal((await planVersion(cwd, head, { candidate: false })).commit, head);
    await assert.rejects(planVersion(cwd, other, { candidate: false }), triggeringCommit);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('non-candidate planVersion refuses an expected value that is not 40 lowercase hex', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'main-push-sha-'));
  const sha256 = await mkdtemp(join(tmpdir(), 'main-push-sha256-'));
  try {
    const { commit } = prepare(cwd);
    const head = commit('feat: initial');
    const invalid = [undefined, '', head.slice(0, 39), `${head}a`, 'g'.repeat(40)];
    if (head.toUpperCase() !== head) invalid.push(head.toUpperCase());
    for (const expected of invalid) {
      await assert.rejects(planVersion(cwd, expected, { candidate: false }), triggeringCommit);
    }

    // A SHA-256 HEAD is 64 hex characters and is the expected value. The guard
    // still refuses it: the triggering commit must be 40 lowercase hex characters.
    const long = prepare(sha256, 'sha256').commit('feat: sha256 checkout');
    assert.match(long, /^[0-9a-f]{64}$/);
    await assert.rejects(planVersion(sha256, long, { candidate: false }), triggeringCommit);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(sha256, { recursive: true, force: true });
  }
});

test('non-candidate main push passes GITHUB_SHA into the non-replay plan', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'main-push-run-'));
  const saved = { ...process.env };
  try {
    const { commit } = prepare(cwd);
    const parent = commit('feat: initial');
    const head = commit('fix: follow-up');
    assert.notEqual(parent, head);
    const noWriter = async () => {
      throw new Error('a main-push plan must not invoke the writer');
    };
    // RELEASE_EXPECTED_COMMIT stays on the other commit. Candidate mode is off
    // and this is not a delivery retry, so the plan must take GITHUB_SHA.
    const invoke = (file, sha, expectedCommit) => {
      process.env = {
        PATH: saved.PATH, HOME: saved.HOME,
        RELEASE_DRY_RUN: 'true', RELEASE_DRAFT: 'false', RELEASE_CANDIDATE: 'false',
        RELEASE_PLAN_ONLY: 'true', RELEASE_REPLAY_TAG: '',
        RELEASE_WRITER_EXPECTED_VERSION: '', RELEASE_WRITER_EXPECTED_COMMIT: '',
        RELEASE_EXPECTED_COMMIT: expectedCommit,
        GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_WORKSPACE: cwd,
        GITHUB_SHA: sha, GITHUB_OUTPUT: join(cwd, file), GITHUB_TOKEN: '', GH_TOKEN: '',
        GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1',
      };
      return run({ releaseEngine: noWriter });
    };
    await invoke('matched', head, parent);
    const matched = Object.fromEntries((await readFile(join(cwd, 'matched'), 'utf8'))
      .trimEnd().split('\n').map(line => line.split('=')));
    assert.equal(matched.commit, head);
    assert.equal(matched.published, 'false');

    await assert.rejects(invoke('mismatched', parent, head), triggeringCommit);
    await assert.rejects(readFile(join(cwd, 'mismatched')), { code: 'ENOENT' });
  } finally {
    process.env = saved;
    await rm(cwd, { recursive: true, force: true });
  }
});
