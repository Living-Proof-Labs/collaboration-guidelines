// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');

test('manual builds and deploys only from an exact verified release tag', async () => {
  const manual = await read('.github/workflows/manual.yml');
  const release = await read('.github/workflows/release.yml');

  assert.doesNotMatch(manual, /^\s*push:\s*$/m);
  assert.match(manual, /^\s*pull_request:\s*$/m);
  assert.match(manual, /^\s*workflow_call:\s*$/m);
  assert.match(manual, /release_tag:\s*\n\s*required:\s*true/m);
  assert.match(manual, /git rev-parse "\$\{RELEASE_TAG\}\^\{commit\}"/);
  assert.match(manual, /deploy:[\s\S]*inputs\.release_tag != ''/);

  assert.match(release, /deploy-manual:/);
  assert.match(release, /needs:\s*\[verify,\s*release,\s*publish-tooling\]/);
  assert.match(release, /uses:\s*\.\/\.github\/workflows\/manual\.yml/);
  assert.match(release, /release_tag:\s*\$\{\{\s*needs\.release\.outputs\.git-tag\s*\}\}/);
  assert.match(release, /needs\.release\.outputs\.published == 'true'/);
});
