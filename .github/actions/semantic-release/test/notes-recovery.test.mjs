// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import { inspect } from 'node:util';
import semanticRelease from 'semantic-release';
import { defaultGh } from '../notes-recovery.mjs';
import { run } from '../run.mjs';

const envToken = 'ghs_envLeakCanary0123456789';
const urlToken = 'ghs_urlLeakCanary99990000';

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

function captureConsole() {
  const lines = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const saved = {};
  for (const method of methods) {
    saved[method] = console[method];
    console[method] = (...args) => {
      lines.push(args.map(arg => typeof arg === 'string' ? arg : inspect(arg, { depth: 6 })).join(' '));
    };
  }
  return {
    text: () => lines.join('\n'),
    restore() {
      for (const method of methods) console[method] = saved[method];
    },
  };
}

function rendered(error) {
  return [error?.message, error?.stack, error?.stderr, error?.stdout, error?.command, error?.output,
    inspect(error, { depth: 6 })].map(value => String(value ?? '')).join('\n');
}

function assertRedacted(text, secrets, label) {
  const value = String(text);
  for (const secret of secrets) {
    assert.equal(value.includes(secret), false, `${label} still contains a credential`);
    assert.equal(value.includes(encodeURIComponent(secret)), false, `${label} still contains an encoded credential`);
  }
  assert.doesNotMatch(value, /https?:\/\/(?!\*\*\*@)[^\s/@]+@/i, `${label} still contains URL userinfo`);
}

function writtenOutput(cwd) {
  try {
    return readFileSync(join(cwd, 'outputs'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
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

test('a bare-tag ls-remote failure redacts the authenticated url', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const logs = captureConsole();
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: bare tag remote failure');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
      GITHUB_ACTION: 'true',
      GITHUB_TOKEN: envToken,
      GITHUB_SERVER_URL: 'https://127.0.0.1:9',
    });
    await assert.rejects(run({
      releaseEngine: async () => assert.fail('writer must not run'),
      gh: () => assert.fail('gh must not run when the remote lookup fails'),
      sleep: async () => {},
    }), error => {
      const text = `${rendered(error)}\n${logs.text()}\n${writtenOutput(fixture.cwd)}`;
      assertRedacted(text, [envToken], 'bare-tag ls-remote failure');
      assert.match(error.message, /https:\/\/\*\*\*@127\.0\.0\.1:9\/example\/consumer\.git/);
      assert.match(error.stack, /https:\/\/\*\*\*@127\.0\.0\.1:9\/example\/consumer\.git/);
      return true;
    });
  } finally {
    logs.restore();
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a notes-recovery ls-remote failure redacts credential urls', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const logs = captureConsole();
  const secrets = [envToken, urlToken];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: notes remote failure');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      GITHUB_ACTION: 'true',
      GITHUB_TOKEN: envToken,
      GH_TOKEN: envToken,
      GITHUB_SERVER_URL: 'https://127.0.0.1:9',
    });
    await assert.rejects(run({
      releaseEngine: async () => {
        throw new Error(`git push failed to push refs/notes/semantic-release-v1.0.1 ${urlToken} ` +
          `https://x-access-token:${urlToken}@github.com/example/consumer.git?token=${urlToken}`);
      },
      gh: () => assert.fail('gh must not run when the remote lookup fails'),
      sleep: async () => assert.fail('notes must not be retried before the remote tag is read'),
    }), error => {
      const text = `${rendered(error)}\n${logs.text()}\n${writtenOutput(fixture.cwd)}`;
      assertRedacted(text, secrets, 'notes ls-remote failure');
      assert.match(error.message, /https:\/\/\*\*\*@127\.0\.0\.1:9\/example\/consumer\.git/);
      return true;
    });
  } finally {
    logs.restore();
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a recovery gh failure redacts credential urls in the error, cause, and step output', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const logs = captureConsole();
  const secrets = [envToken, urlToken];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: gh failure leak');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
      GITHUB_TOKEN: envToken,
      GH_TOKEN: envToken,
    });
    await assert.rejects(run({
      releaseEngine: async () => assert.fail('writer must not run'),
      gh: () => {
        const error = new Error(
          `Command failed: gh release view https://x-access-token:${urlToken}@github.com/example/consumer` +
          `?access_token=${urlToken}&token=${envToken} raw ${envToken}`,
        );
        error.stderr = `https://user:${urlToken}@github.com/example/consumer.git?client_secret=${urlToken}`;
        error.stdout = `stdout ${envToken}`;
        error.cause = new Error(
          `nested http://oauth2:${urlToken}@github.com/example/consumer?api_key=${encodeURIComponent(urlToken)}`,
        );
        throw error;
      },
      sleep: async () => {},
    }), error => {
      const text = `${rendered(error)}\n${logs.text()}\n${writtenOutput(fixture.cwd)}`;
      assertRedacted(text, secrets, 'gh failure');
      assert.match(error.message, /https:\/\/\*\*\*@github\.com\/example\/consumer\?access_token=\*\*\*&token=\*\*\*/);
      assert.match(String(error.stderr), /https:\/\/\*\*\*@github\.com\/example\/consumer\.git\?client_secret=\*\*\*/);
      assert.match(error.cause.message, /http:\/\/\*\*\*@github\.com\/example\/consumer\?api_key=\*\*\*/);
      assert.equal(String(error.stdout).includes(envToken), false);
      return true;
    });
  } finally {
    logs.restore();
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('an unhandled writer failure on the recovery path redacts credential urls', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const logs = captureConsole();
  const secrets = [envToken, urlToken];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: unhandled leak');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('push', 'origin', 'main');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      GITHUB_TOKEN: envToken,
      GH_TOKEN: envToken,
    });
    await assert.rejects(run({
      releaseEngine: async () => {
        const error = new Error(
          `publisher failed https://user:password@github.com/example/consumer.git?github_token=${urlToken} ${envToken}`,
        );
        error.stderr = `https://x-access-token:${urlToken}@github.com/example/consumer.git`;
        error.cause = new Error(`cause ${envToken} https://token@github.com/example/consumer?password=${urlToken}`);
        throw error;
      },
      gh: () => assert.fail('gh must not run for an unhandled writer error'),
      sleep: async () => {},
    }), error => {
      const text = `${rendered(error)}\n${logs.text()}\n${writtenOutput(fixture.cwd)}`;
      assertRedacted(text, secrets, 'unhandled writer failure');
      assert.match(error.message, /https:\/\/\*\*\*@github\.com\/example\/consumer\.git\?github_token=\*\*\*/);
      assert.match(String(error.stderr), /https:\/\/\*\*\*@github\.com\/example\/consumer\.git/);
      assert.match(error.cause.message, /https:\/\/\*\*\*@github\.com\/example\/consumer\?password=\*\*\*/);
      return true;
    });
  } finally {
    logs.restore();
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('recovery step output redacts credential urls returned for the release', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const logs = captureConsole();
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: output leak');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
      GITHUB_TOKEN: envToken,
      GH_TOKEN: envToken,
    });
    await run({
      releaseEngine: async () => assert.fail('an existing tag must be recovered without the writer'),
      gh: args => {
        if (args[1] === 'view') {
          const error = new Error('Command failed: gh release view');
          error.status = 1;
          error.stderr = 'release not found\n';
          throw error;
        }
        if (args[1] === 'create') {
          return `https://x-access-token:${envToken}@github.example.invalid/example/consumer/releases/tag/${args[2]}` +
            `?access_token=${envToken}&keep=1\n`;
        }
        throw new Error(`unexpected gh ${args.join(' ')}`);
      },
      sleep: async () => {},
    });
    const text = `${writtenOutput(fixture.cwd)}\n${logs.text()}`;
    assertRedacted(text, [envToken], 'recovery step output');
    assert.match(text,
      /release-url=https:\/\/\*\*\*@github\.example\.invalid\/example\/consumer\/releases\/tag\/v1\.0\.1\?access_token=\*\*\*&keep=1/);
  } finally {
    logs.restore();
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('recovery gh commands name the repository and run in the workspace', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const calls = [];
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: bind the repository');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
    });
    await run({
      releaseEngine: async () => assert.fail('writer must not run'),
      gh: (args, options = {}) => {
        calls.push({ args: [...args], cwd: options.cwd });
        if (args[1] === 'view') {
          const error = new Error('Command failed: gh release view');
          error.status = 1;
          error.stderr = 'release not found\n';
          throw error;
        }
        if (args[1] === 'create') {
          return `https://github.example.invalid/example/consumer/releases/tag/${args[2]}\n`;
        }
        throw new Error(`unexpected gh ${args.join(' ')}`);
      },
      sleep: async () => {},
    });
    assert.ok(calls.some(call => call.args[1] === 'view'));
    assert.ok(calls.some(call => call.args[1] === 'create'));
    for (const call of calls) {
      const repoFlag = call.args.indexOf('--repo');
      assert.equal(call.args[repoFlag + 1], 'example/consumer');
      assert.equal(call.cwd, fixture.cwd);
      assert.equal(call.args[2], 'v1.0.1');
    }
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('recovery refuses a repository name that is not owner/name without echoing it', async () => {
  const fixture = await repo();
  const saved = { ...process.env };
  const secret = 'ghs_repoNameLeakCanary4242';
  try {
    fixture.git('commit', '--allow-empty', '-m', 'fix: reject a bad repository');
    const head = fixture.git('rev-parse', 'HEAD');
    fixture.git('tag', 'v1.0.1', head);
    fixture.git('push', 'origin', 'main', '--tags');
    bind(saved, fixture.cwd, fixture.gitEnv, head, {
      RELEASE_WRITER_EXPECTED_VERSION: '1.0.1',
      RELEASE_WRITER_EXPECTED_COMMIT: head,
      GITHUB_REPOSITORY: `not a repo ${secret}`,
    });
    await assert.rejects(run({
      releaseEngine: async () => assert.fail('writer must not run'),
      gh: () => assert.fail('gh must not run without a repository name'),
      sleep: async () => {},
    }), error => {
      assert.match(error.message, /Recovery requires GITHUB_REPOSITORY as owner\/name/);
      assert.equal(rendered(error).includes(secret), false);
      return true;
    });
  } finally {
    process.env = saved;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('defaultGh runs in the workspace when the process cwd is elsewhere', async () => {
  const root = await mkdtemp(join(tmpdir(), 'default-gh-'));
  const workspace = join(root, 'workspace');
  const outside = join(root, 'outside');
  const bin = join(root, 'bin');
  const spy = join(root, 'spy');
  await mkdir(workspace);
  await mkdir(outside);
  await mkdir(bin);
  await writeFile(join(bin, 'gh'), `#!/bin/sh
printf '%s\\n' "$PWD" >> ${JSON.stringify(spy)}
printf '%s\\n' "$@" >> ${JSON.stringify(spy)}
printf '\\n' >> ${JSON.stringify(spy)}
`);
  await chmod(join(bin, 'gh'), 0o755);
  const saved = { ...process.env };
  const previous = process.cwd();
  try {
    process.chdir(outside);
    process.env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_WORKSPACE: workspace,
      GH_TOKEN: '',
    };
    delete process.env.GITHUB_TOKEN;
    defaultGh(['release', 'view', 'v1.0.0', '--repo', 'example/consumer']);
    defaultGh(['release', 'view', 'v1.0.0', '--repo', 'example/consumer'], { cwd: workspace });
    const records = (await readFile(spy, 'utf8')).trim().split('\n\n');
    assert.equal(records.length, 2);
    for (const record of records) assert.equal(record.split('\n')[0], workspace);
  } finally {
    process.chdir(previous);
    process.env = saved;
    await rm(root, { recursive: true, force: true });
  }
});
