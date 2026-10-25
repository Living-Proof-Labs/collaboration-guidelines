// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import { generateNotes } from '@semantic-release/release-notes-generator';
import config from '../release.config.mjs';
import { outputs, configuration } from '../run.mjs';
const analyzer = config.plugins[0][1];
const notes = config.plugins[1][1];
const logger = { log() {}, error() {}, success() {} };
function context(messages) {
  return {
    cwd: process.cwd(), logger,
    options: { repositoryUrl: 'https://github.com/example/consumer' },
    commits: messages.map((message, i) => ({ message, hash: String(i + 1).repeat(40) })),
    lastRelease: { version: '1.0.0', gitTag: 'v1.0.0', gitHead: 'a'.repeat(40) },
    nextRelease: { version: '1.0.1', gitTag: 'v1.0.1', gitHead: 'b'.repeat(40) },
  };
}
for (const [message, level] of [
  ['feat: new option', 'minor'], ['fix: repair', 'patch'],
  ['feat!: incompatible option', 'major'], ['chore!: change runtime', 'major'],
  ['docs: revised contract\n\nBREAKING CHANGE: remove supported behavior', 'major'],
  ...['docs', 'chore', 'build', 'ci', 'test', 'refactor', 'style', 'perf', 'revert']
    .map(type => [`${type}: improve guidance`, 'patch']),
]) {
  test(`policy: ${message.split('\n')[0]}`, async () => {
    const ctx = context([message]);
    assert.equal(await analyzeCommits(analyzer, ctx), level);
    assert.ok((await generateNotes(notes, ctx)).includes(ctx.commits[0].hash.slice(0, 7)));
  });
}
test('batch selects highest impact; unclassified or empty input does not release', async () => {
  assert.equal(await analyzeCommits(analyzer, context(['docs: guide', 'feat: option'])), 'minor');
  assert.equal(await analyzeCommits(analyzer, context([])), null);
  assert.equal(await analyzeCommits(analyzer, context(['Merge pull request #1'])), null);
});
test('official plugins filter a reverted change and its notes', async () => {
  const ctx = context(['feat: temporary']);
  // semantic-release supplies commits newest first.
  ctx.commits.unshift({
    hash: 'c'.repeat(40),
    message: `revert: feat: temporary\n\nThis reverts commit ${ctx.commits[0].hash}.`,
  });
  assert.equal(await analyzeCommits(analyzer, ctx), null);
  assert.ok(!(await generateNotes(notes, ctx)).includes('temporary'));
});
test('outputs distinguish published, dry-run and no-release outcomes', () => {
  const result = { nextRelease: { version: '1.2.3', gitTag: 'v1.2.3' },
    releases: [{ url: 'https://github.com/example/consumer/releases/tag/v1.2.3' }] };
  assert.deepEqual(outputs(false, false),
    { published: 'false', 'draft-created': 'false', version: '', 'git-tag': '', 'release-url': '' });
  assert.equal(outputs(result, false).published, 'true');
  assert.equal(outputs(result, false)['release-url'], result.releases[0].url);
  assert.deepEqual(outputs(result, true),
    { published: 'false', 'draft-created': 'false', version: '1.2.3', 'git-tag': 'v1.2.3', 'release-url': '' });
});

test('draft release delegates to the official plugin without claiming public publication', () => {
  const result = { nextRelease: { version: '2.2.0', gitTag: 'v2.2.0' }, releases: [] };
  assert.equal(configuration(true).plugins[2][1].draftRelease, true);
  assert.equal(configuration(false).plugins[2][1].draftRelease, false);
  assert.equal(config.plugins[2][1].draftRelease, undefined);
  assert.equal(outputs(result, false, true).published, 'false');
  assert.equal(outputs(result, false, true)['draft-created'], 'true');
  assert.equal(outputs(result, true, true)['draft-created'], 'false');
  assert.equal(outputs(false, false, true)['draft-created'], 'false');
});
