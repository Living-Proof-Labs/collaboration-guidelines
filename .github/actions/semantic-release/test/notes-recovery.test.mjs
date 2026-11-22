// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import { run } from '../run.mjs';

const repositoryUrl = 'https://github.example.invalid/example/consumer.git';
const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });

function gitEnvFor(root) {
  return {
    GIT_ALLOW_PROTOCOL: 'file', PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Release Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Release Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_TERMINAL_PROMPT: '0',
  };
}

async function installNotesHook(remote, failCount) {
  const hook = join(remote, 'hooks', 'pre-receive');
  const countFile = join(remote, 'notes-pushes');
  await writeFile(hook, `#!/bin/sh
set -eu
count_file=${JSON.stringify(countFile)}
while read -r old new ref; do
  case "$ref" in
    refs/notes/*)
      n=0
      if [ -f "$count_file" ]; then
        n=$(cat "$count_file")
      fi
      n=$((n + 1))
      printf '%s\\n' "$n" > "$count_file"
      if [ "$n" -le ${Number(failCount)} ]; then
        echo "remote rejected $ref" >&2
        exit 1
      fi
      ;;
  esac
done
exit 0
`);
  await chmod(hook, 0o755);
  return countFile;
}

function ghDouble(calls, { existing = false, existingDraft = false } = {}) {
  return (args, { input } = {}) => {
    calls.push({ args: [...args], input });
    if (args[0] === 'release' && args[1] === 'view') {
      if (!existing) {
        const error = new Error('Command failed: gh release view');
        error.status = 1;
        error.stderr = 'release not found\n';
        throw error;
      }
      return JSON.stringify({
        tagName: args[2], isDraft: existingDraft,
        url: `https://github.example.invalid/example/consumer/releases/tag/${args[2]}`,
      });
    }
    if (args[0] === 'release' && args[1] === 'create') {
      return `https://github.example.invalid/example/consumer/releases/tag/${args[2]}\n`;
    }
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
}

async function repo() {
  const root = await mkdtemp(join(tmpdir(), 'notes-recovery-'));
  const remote = join(root, 'remote.git');
  const cwd = join(root, 'consumer');
  const gitEnv = gitEnvFor(root);
  const git = (...args) => execFileSync('git', args, {
    cwd, env: gitEnv, encoding: 'utf8', stdio: 'pipe',
  }).trim();
  const remoteGit = (...args) => execFileSync('git', args, {
    cwd: remote, env: gitEnv, encoding: 'utf8', stdio: 'pipe',
  }).trim();
  execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { env: gitEnv, stdio: 'pipe' });
  execFileSync('git', ['clone', remote, cwd], { env: gitEnv, stdio: 'pipe' });
  git('config', 'user.name', 'Release Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', `url.file://${remote}.insteadOf`, repositoryUrl);
  git('commit', '--allow-empty', '-m', 'feat: initial release');
  git('tag', 'v1.0.0');
  git('push', 'origin', 'main', '--tags');
  const initialTag = git('rev-parse', 'v1.0.0^{commit}');
  const refs = () => Object.fromEntries(remoteGit('show-ref').split('\n').filter(Boolean).map(line => {
    const [sha, ref] = line.split(' ');
    return [ref, sha];
  }));
  return { root, remote, cwd, gitEnv, git, remoteGit, refs, initialTag };
}

function engine(gitEnv) {
  return (options, context) => semanticRelease({
    ...options,
    plugins: options.plugins.filter((_, index) => index !== 2),
    ci: false,
  }, { cwd: context.cwd, env: gitEnv, stdout: sink, stderr: sink });
}

function bind(saved, cwd, gitEnv, head, overrides = {}) {
  process.env = {
    ...gitEnv, RELEASE_DRY_RUN: 'false', RELEASE_DRAFT: 'false', GITHUB_REF: 'refs/heads/main',
    GITHUB_WORKSPACE: cwd, GITHUB_SHA: head, GITHUB_OUTPUT: join(cwd, 'outputs'),
    GITHUB_SERVER_URL: 'https://github.example.invalid', GITHUB_REPOSITORY: 'example/consumer',
    ...overrides,
  };
  return { saved };
}

async function output(cwd) {
  return Object.fromEntries((await readFile(join(cwd, 'outputs'), 'utf8'))
    .trimEnd().split('\n').filter(Boolean).map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }));
}

test('notes push failure retries without moving tags and still publishes the release', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const pushes = [];
  const delays = [];
  const calls = [];
  try {
    const countFile = await installNotesHook(fixture.remote, 99);
    fixture.git('commit', '--allow-empty', '-m', 'fix: record the channel note');
    fixture.git('push', 'origin', 'main');
    const head = fixture.git('rev-parse', 'HEAD');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head);
    const execFile = (file, args, opts) => {
      pushes.push(args);
      return execFileSync(file, args, opts);
    };
    await run({
      releaseEngine: engine(fixture.gitEnv),
      execFile,
      gh: ghDouble(calls),
      sleep: async ms => { delays.push(ms); },
    });
    const values = await output(fixture.cwd);
    assert.equal(values.published, 'true');
    assert.equal(values['draft-created'], 'false');
    assert.equal(values.version, '1.0.1');
    assert.equal(values['git-tag'], 'v1.0.1');
    assert.equal(values.commit, head);
    assert.equal(values['release-url'],
      'https://github.example.invalid/example/consumer/releases/tag/v1.0.1');
    const create = calls.find(call => call.args[1] === 'create');
    assert.ok(create, 'expected gh release create');
    assert.ok(create.args.includes('--verify-tag'));
    assert.equal(create.args.includes('--target'), false);
    assert.equal(create.args.includes('--draft'), false);
    assert.match(create.input, /record the channel note/);
    assert.deepEqual(delays, [1000, 2000, 4000]);
    assert.equal((await readFile(countFile, 'utf8')).trim(), '4');
    for (const args of pushes) {
      assert.equal(args.includes('--force'), false);
      assert.equal(args.includes('--tags'), false);
      assert.equal(args.at(-1), 'refs/notes/semantic-release-v1.0.1');
    }
    const after = fixture.refs();
    assert.equal(after['refs/tags/v1.0.0'], before['refs/tags/v1.0.0']);
    assert.equal(after['refs/tags/v1.0.1'], head);
    assert.equal(after['refs/notes/semantic-release-v1.0.1'], undefined);
    assert.equal(fixture.git('rev-parse', 'v1.0.0^{commit}'), fixture.initialTag);
    assert.equal(fixture.git('rev-parse', 'v1.0.1^{commit}'), head);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a notes retry that succeeds still publishes because the writer never reached publish', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  const delays = [];
  try {
    const countFile = await installNotesHook(fixture.remote, 1);
    fixture.git('commit', '--allow-empty', '-m', 'fix: retry the notes ref');
    fixture.git('push', 'origin', 'main');
    const head = fixture.git('rev-parse', 'HEAD');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head);
    await run({
      releaseEngine: engine(fixture.gitEnv),
      gh: ghDouble(calls),
      sleep: async ms => { delays.push(ms); },
    });
    const values = await output(fixture.cwd);
    assert.equal(values.published, 'true');
    assert.equal(values.version, '1.0.1');
    assert.equal(values['git-tag'], 'v1.0.1');
    assert.match(calls.find(call => call.args[1] === 'create').input, /retry the notes ref/);
    assert.deepEqual(delays, [1000]);
    assert.equal((await readFile(countFile, 'utf8')).trim(), '2');
    const after = fixture.refs();
    assert.equal(after['refs/tags/v1.0.0'], before['refs/tags/v1.0.0']);
    assert.equal(after['refs/tags/v1.0.1'], head);
    assert.ok(after['refs/notes/semantic-release-v1.0.1']);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('an unguarded rerun publishes a bare tag at HEAD instead of reporting no release', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: second attempt');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head);
    await run({
      releaseEngine: engine(fixture.gitEnv), gh: ghDouble(calls), sleep: async () => {},
    });
    const values = await output(fixture.cwd);
    assert.equal(values.published, 'true');
    assert.equal(values.version, '1.0.1');
    assert.equal(values['git-tag'], 'v1.0.1');
    assert.equal(values.commit, head);
    assert.ok(calls.find(call => call.args[1] === 'create').args.includes('--verify-tag'));
    assert.match(calls.find(call => call.args[1] === 'create').input, /second attempt/);
    assert.deepEqual(fixture.refs(), before);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a bare tag at HEAD with no Release is published in place, including drafts', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: publish the bare tag');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_DRAFT: 'true',
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
    });
    const noEngine = async () => assert.fail('recovery must not run the writer again');
    await run({ releaseEngine: noEngine, gh: ghDouble(calls), sleep: async () => {} });
    const values = await output(fixture.cwd);
    assert.equal(values.published, 'false');
    assert.equal(values['draft-created'], 'true');
    assert.equal(values.version, '1.0.1');
    assert.equal(values['git-tag'], 'v1.0.1');
    assert.equal(values.commit, head);
    assert.equal(values['release-url'],
      'https://github.example.invalid/example/consumer/releases/tag/v1.0.1');
    const create = calls.find(call => call.args[1] === 'create');
    assert.ok(create.args.includes('--verify-tag'));
    assert.ok(create.args.includes('--draft'));
    assert.equal(create.args.includes('--target'), false);
    assert.match(create.input, /publish the bare tag/);
    assert.deepEqual(fixture.refs(), before);
    assert.equal(fixture.git('rev-parse', 'v1.0.1^{commit}'), head);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a version tag that points at a different commit is refused and left untouched', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'feat: next channel');
    fixture.git('push', 'origin', 'main');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('checkout', '--orphan', 'unrelated');
    fixture.git('commit', '--allow-empty', '-m', 'chore: unrelated history');
    const elsewhere = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.1.0', elsewhere);
    fixture.git('push', 'origin', 'v1.1.0');
    fixture.git('checkout', 'main');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.1.0',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
    });
    await assert.rejects(run({
      releaseEngine: engine(fixture.gitEnv),
      gh: ghDouble(calls),
      sleep: async () => assert.fail('notes must not be retried for a tag at another commit'),
    }), /refusing to create a release or move the tag/);
    assert.equal(calls.some(call => call.args[1] === 'create'), false);
    assert.equal(fixture.refs()['refs/tags/v1.1.0'], before['refs/tags/v1.1.0']);
    assert.equal(fixture.git('rev-parse', 'v1.1.0^{commit}'), elsewhere);
    assert.equal(fixture.refs()['refs/tags/v1.1.1'], undefined);
    assert.equal(fixture.git('rev-parse', 'v1.0.0^{commit}'), fixture.initialTag);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('an existing Release for the tag at HEAD is left unchanged', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: already released');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    const before = fixture.refs();
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
    });
    const noEngine = async () => assert.fail('an existing release must not invoke the writer');
    await run({
      releaseEngine: noEngine,
      gh: ghDouble(calls, { existing: true, existingDraft: true }),
      sleep: async () => assert.fail('notes must not be retried when a release exists'),
    });
    const values = await output(fixture.cwd);
    assert.equal(values.published, 'false');
    assert.equal(values['draft-created'], 'false');
    assert.equal(values.version, '');
    assert.equal(values['git-tag'], '');
    assert.equal(values['release-url'], '');
    assert.equal(values.commit, head);
    assert.equal(calls.some(call => call.args[1] === 'create'), false);
    assert.ok(calls.some(call => call.args[1] === 'view'));
    assert.deepEqual(fixture.refs(), before);
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});
