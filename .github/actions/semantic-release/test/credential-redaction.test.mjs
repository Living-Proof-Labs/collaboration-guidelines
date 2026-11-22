// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inspect } from 'node:util';
import { redactError, redactText, retryNotesPush } from '../notes-recovery.mjs';

const token = 'ghs_leakCanary0123456789';
const other = 'ghp_otherLeakCanary000777';

function rendered(error) {
  return inspect(error, { depth: 6 });
}

test('redactText removes userinfo, token queries, and configured tokens', () => {
  const env = { GITHUB_TOKEN: token, GH_TOKEN: other };
  const input = [
    `https://x-access-token:${token}@github.com/acme/app.git`,
    `https://user:${other}@github.com/acme/app.git`,
    `http://only-user@github.com/acme/app.git`,
    `https://github.com/acme/app.git?access_token=${token}&github_token=${other}&keep=1`,
    `https://github.com/acme/app.git?token=${token}&api_key=${other}&client_secret=${token}`,
    `https://github.com/acme/app.git?password=${token}&refresh_token=${other}`,
    `plain ${token} encoded ${encodeURIComponent(`${token}/secret`)}`,
    'https://github.com/acme/app/releases/tag/v1.2.3',
    'https://example.com/search?keyword=value&token_type=bearer',
    'x-access-token:not-the-env-token',
  ].join('\n');
  const cleaned = redactText(input, { ...env, GH_TOKEN: `${token}/secret` });
  assert.equal(cleaned.includes(token), false);
  assert.equal(cleaned.includes(other), false);
  assert.equal(cleaned.includes(encodeURIComponent(`${token}/secret`)), false);
  assert.equal(cleaned.includes('not-the-env-token'), false);
  assert.match(cleaned, /https:\/\/\*\*\*@github\.com\/acme\/app\.git/);
  assert.match(cleaned, /http:\/\/\*\*\*@github\.com\/acme\/app\.git/);
  assert.match(cleaned, /access_token=\*\*\*&github_token=\*\*\*&keep=1/);
  assert.match(cleaned, /token=\*\*\*&api_key=\*\*\*&client_secret=\*\*\*/);
  assert.match(cleaned, /password=\*\*\*&refresh_token=\*\*\*/);
  assert.match(cleaned, /https:\/\/github\.com\/acme\/app\/releases\/tag\/v1\.2\.3/);
  assert.match(cleaned, /keyword=value&token_type=bearer/);
  assert.equal(redactText(cleaned, env), cleaned);
});

test('redactText still strips url credentials when the token is not configured', () => {
  const cleaned = redactText('https://oauth2:short@host/repo?api-key=short&x=1', { GITHUB_TOKEN: 'short' });
  assert.equal(cleaned, 'https://***@host/repo?api-key=***&x=1');
  assert.equal(redactText('status short', { GITHUB_TOKEN: 'short' }), 'status short');
});

test('redactError scrubs message, stack, buffers, output, and cause', () => {
  const error = new Error(`push failed https://x-access-token:${token}@github.com/acme/app.git?access_token=${token}`);
  error.stderr = Buffer.from(`stderr https://user:${other}@github.com/acme/app.git?client_secret=${other}`);
  error.stdout = `stdout ${token}`;
  error.output = [null, error.stdout, Buffer.from(`output ${token}`)];
  error.cause = new Error(`nested http://token@github.com/acme/app?password=${encodeURIComponent(token)}`);
  const redacted = redactError(error, { GITHUB_TOKEN: token, GH_TOKEN: other });
  assert.equal(redacted, error);
  const text = `${rendered(redacted)}\n${redacted.stack}\n${redacted.cause.stack}`;
  assert.equal(text.includes(token), false);
  assert.equal(text.includes(other), false);
  assert.equal(text.includes(encodeURIComponent(token)), false);
  assert.match(redacted.message, /https:\/\/\*\*\*@github\.com\/acme\/app\.git\?access_token=\*\*\*/);
  assert.match(String(redacted.stderr), /https:\/\/\*\*\*@github\.com\/acme\/app\.git\?client_secret=\*\*\*/);
  assert.equal(redacted.stdout.includes(token), false);
  assert.equal(redacted.output[2].includes(token), false);
  assert.match(redacted.cause.message, /http:\/\/\*\*\*@github\.com\/acme\/app\?password=\*\*\*/);
});

test('a real git ls-remote failure is printable without credentials', () => {
  const url = `https://x-access-token:${token}@127.0.0.1:9/acme/app.git?access_token=${token}&x=1`;
  let caught;
  try {
    execFileSync('git', ['ls-remote', '--', url], {
      encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'expected git ls-remote to fail');
  const redacted = redactError(caught, { GITHUB_TOKEN: token });
  const text = `${redacted.message}\n${redacted.stack}\n${redacted.stderr}\n${redacted.output}\n${rendered(redacted)}`;
  assert.equal(text.includes(token), false);
  assert.match(redacted.message, /https:\/\/\*\*\*@127\.0\.0\.1:9\/acme\/app\.git\?access_token=\*\*\*&x=1/);
  assert.match(String(redacted.stderr), /access_token=\*\*\*/);
  assert.doesNotMatch(text, /https?:\/\/(?!\*\*\*@)[^\s/@]+@/i);
});

test('a swallowed notes push failure is not logged with its credential url', async () => {
  const url = `https://x-access-token:${token}@github.com/acme/app.git?token=${token}`;
  const lines = [];
  const saved = console.error;
  console.error = (...args) => lines.push(args.map(arg => String(arg)).join(' '));
  try {
    const pushed = await retryNotesPush({
      cwd: process.cwd(),
      url,
      ref: 'refs/notes/semantic-release-v1.0.1',
      sleep: async () => {},
      execFile: () => {
        const error = new Error(`Command failed: git push -- ${url}`);
        error.stderr = `rejected ${url}`;
        throw error;
      },
    });
    assert.equal(pushed, false);
    assert.equal(lines.join('\n').includes(token), false);
  } finally {
    console.error = saved;
  }
});
