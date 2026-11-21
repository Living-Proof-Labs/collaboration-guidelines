// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { run, verifyTagMatchesCommit } from '../run.mjs';

function parseOutputs(text) {
  return Object.fromEntries(
    text.trim().split('\n').filter(Boolean).map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    }),
  );
}

test('candidate and main share version calculation; main refuses mismatched tag', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shared-candidate-'));
  const remote = join(root, 'origin.git');
  const cwd = join(root, 'repo');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const saved = { ...process.env };
  try {
    execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'pipe' });
    execFileSync('git', ['clone', remote, cwd], { stdio: 'pipe' });
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'test@example.invalid');
    const repositoryUrl = 'https://github.com/example/publisher';
    git('config', `url.file://${remote}.insteadOf`, repositoryUrl);

    // 1. First release on candidate branch: proposes 1.0.0 with no tag created.
    git('commit', '--allow-empty', '-m', 'feat: initial publisher');
    git('push', 'origin', 'main');
    const mainHead = git('rev-parse', 'HEAD');
    git('checkout', '-b', 'pr-feature');
    git('commit', '--allow-empty', '-m', 'fix: candidate fix');
    git('push', 'origin', 'pr-feature');
    const prHead = git('rev-parse', 'HEAD');

    const out1 = join(root, 'out1');
    Object.assign(process.env, {
      GITHUB_WORKSPACE: cwd,
      GITHUB_OUTPUT: out1,
      GITHUB_REF: 'refs/pull/1/merge',
      GITHUB_SHA: prHead,
      GITHUB_SERVER_URL: `file://${root}`,
      GITHUB_REPOSITORY: 'origin',
      RELEASE_DRY_RUN: 'false',
      RELEASE_DRAFT: 'false',
      RELEASE_CANDIDATE: 'true',
    });
    await run();
    const cand1 = parseOutputs(await readFile(out1, 'utf8'));
    assert.equal(cand1.version, '1.0.0');
    assert.equal(cand1['git-tag'], 'v1.0.0');
    assert.equal(cand1.commit, prHead);
    assert.equal(cand1.published, 'false');
    assert.equal(cand1['draft-created'], 'false');
    assert.equal(git('tag', '--list'), '');

    // 2. Tag v1.0.0 on main, then no release due on candidate with no new commits.
    git('checkout', 'main');
    git('tag', 'v1.0.0', mainHead);
    git('push', 'origin', 'v1.0.0');
    const out2 = join(root, 'out2');
    process.env.GITHUB_OUTPUT = out2;
    process.env.GITHUB_SHA = mainHead;
    await run();
    const noRel = parseOutputs(await readFile(out2, 'utf8'));
    assert.equal(noRel.version, '');
    assert.equal(noRel['git-tag'], '');
    assert.equal(noRel.commit, mainHead);
    assert.equal(noRel.published, 'false');

    // 3. Candidate after v1.0.0 with feat: proposes 1.1.0; changed merge history recalculates.
    git('checkout', '-b', 'pr-minor');
    git('commit', '--allow-empty', '-m', 'feat: add feature');
    git('push', 'origin', 'pr-minor');
    const prMinorHead = git('rev-parse', 'HEAD');
    const out3 = join(root, 'out3');
    process.env.GITHUB_OUTPUT = out3;
    process.env.GITHUB_SHA = prMinorHead;
    await run();
    const candMinor = parseOutputs(await readFile(out3, 'utf8'));
    assert.equal(candMinor.version, '1.1.0');
    assert.equal(candMinor['git-tag'], 'v1.1.0');
    assert.equal(candMinor.commit, prMinorHead);

    git('checkout', 'main');
    git('commit', '--allow-empty', '-m', 'feat!: breaking merge title');
    git('push', 'origin', 'main');
    const breakingHead = git('rev-parse', 'HEAD');
    const out4 = join(root, 'out4');
    process.env.GITHUB_OUTPUT = out4;
    process.env.GITHUB_SHA = breakingHead;
    await run();
    const candBreaking = parseOutputs(await readFile(out4, 'utf8'));
    assert.equal(candBreaking.version, '2.0.0');
    assert.equal(candBreaking['git-tag'], 'v2.0.0');
    assert.equal(candBreaking.commit, breakingHead);

    // 4. Tag-to-commit verification passes on exact commit and throws on wrong commit.
    verifyTagMatchesCommit('v1.0.0', mainHead, { cwd, fetchTag: false });
    assert.throws(
      () => verifyTagMatchesCommit('v1.0.0', breakingHead, { cwd, fetchTag: false }),
      /resolves to .*, expected/,
    );
  } finally {
    process.env = saved;
    await rm(root, { recursive: true, force: true });
  }
});
