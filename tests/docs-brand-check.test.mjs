// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {download, main} from '../tools/docs-brand/lock.mjs';
import {createHash} from 'node:crypto';

const repository = 'Living-Proof-Labs/collaboration-guidelines';
const api = `https://api.github.com/repos/${repository}/releases/tags/v1.0.0`;
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('API requests require authentication before any network request', () => {
  for (const token of ['', null, 'secret\nheader: injected', 'secret"', 'secret\\']) {
    assert.throws(() => download(api, token, () => assert.fail('network must not run')), /read-only GitHub token/);
  }
});

test('omitted token requires an explicit runtime credential', () => {
  const saved = process.env.GITHUB_TOKEN;
  try {
    delete process.env.GITHUB_TOKEN;
    assert.throws(() => download(api, undefined, () => assert.fail('network must not run')), /read-only GitHub token/);
  } finally {
    if (saved === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = saved;
  }
});

test('API authentication is stdin-only and is never sent to CSS origin', () => {
  for (const url of [api, `https://raw.githubusercontent.com/${repository}/${'a'.repeat(40)}/brand/docs/brand.css`]) {
    let called = false;
    assert.equal(download(url, 'fixture-secret', (command, args, options) => {
      called = true;
      assert.equal(command, 'curl');
      assert.equal(args.includes('--location'), false);
      assert.equal(args.join(' ').includes('fixture-secret'), false);
      assert.equal(args.includes('--config'), url === api);
      if (url === api) assert.match(options.input, /Authorization: Bearer fixture-secret/);
      else assert.equal(options.input, undefined);
      return Buffer.from('ok\n200');
    }).toString(), 'ok');
    assert.equal(called, true);
  }
});

test('rate limits and transport failures fail closed without leaking subprocess credentials', () => {
  for (const status of [403, 429]) {
    assert.throws(() => download(api, 'fixture-secret', () => {throw Error(`${status} fixture-secret`);}), error => {
      assert.match(error.message, /rate limits/);
      assert.doesNotMatch(error.message, /fixture-secret/);
      return true;
    });
  }
  assert.throws(() => download(api, 'fixture-secret', () => Buffer.from('redirect\n302')), /without redirects/);
});

test('the shipped command rejects version-only proposals and leaves files unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-check-'));
  const before = process.cwd();
  const css = Buffer.from('old css');
  const lock = {repository, version:'v2.0.0', commit:'a'.repeat(40), path:'brand/docs/brand.css',
    sha256:createHash('sha256').update(css).digest('hex')};
  const json = JSON.stringify(lock);
  writeFileSync(join(dir, 'docs-brand.lock.json'), json);
  try {
    process.chdir(dir);
    const get = url => url.includes('/releases/') ? JSON.stringify({tag_name:'v2.0.0',draft:false,prerelease:false})
      : url.includes('/commits/') ? JSON.stringify({sha:'b'.repeat(40)}) : css;
    assert.throws(() => main(['--check'], get), /provenance mismatch/);
    assert.equal(readFileSync('docs-brand.lock.json', 'utf8'), json);
    assert.throws(() => main(['--check'], () => {throw Error('HTTP 429');}), /429/);
    assert.equal(readFileSync('docs-brand.lock.json', 'utf8'), json);
  } finally {process.chdir(before);}
});

test('reusable action uses its own helper and read-only token; CI dogfoods the proposed lock', () => {
  const action = read('.github/actions/docs-brand-check/action.yml');
  assert.match(action, /GITHUB_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(action, /node "\$ACTION_PATH\/\.\.\/\.\.\/\.\.\/tools\/docs-brand\/lock.mjs" --check/);
  assert.doesNotMatch(action, /--update|checkout|secrets\./);
  const workflow = read('.github/workflows/verify.yml');
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/docs-brand-check/);
  assert.ok(workflow.indexOf('actions/checkout@') < workflow.indexOf('uses: ./.github/actions/docs-brand-check'));
});

test('dormant updater forwards only the read-only token to fixed post-upgrade helper', () => {
  assert.match(read('.github/actions/docs-brand-renovate/action.yml'), /GITHUB_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(read('tools/docs-brand/run.sh'), /-e RENOVATE_TOKEN -e GITHUB_TOKEN/);
  const config = read('tools/docs-brand/runner.cjs');
  assert.match(config, /customEnvVariables: \{GITHUB_TOKEN: process.env.GITHUB_TOKEN \?\? ''\}/);
  assert.match(config, /allowedEnv: \[\]/);
  assert.match(config, /exposeAllEnv: false/);
  const workflow = read('.github/workflows/docs-brand-renovate.yml');
  assert.match(workflow, /permissions: \{\}/);
  assert.match(workflow, /update:\n    permissions:\n      contents: read/);
  assert.doesNotMatch(workflow, /^  schedule:/m);
});
