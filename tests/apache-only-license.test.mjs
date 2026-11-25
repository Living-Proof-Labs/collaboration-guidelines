// SPDX-License-Identifier: Apache-2.0
// collaboration-guidelines#162: one root Apache-2.0 LICENSE, no CC BY 4.0.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// SHA-256 of the unmodified SPDX Apache-2.0 text, as in livingproof-common/LICENSE.
const APACHE_2_0_SHA256 = 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4';

test('the root LICENSE is the exact SPDX Apache-2.0 text', () => {
  const digest = createHash('sha256').update(readFileSync('LICENSE')).digest('hex');
  assert.equal(digest, APACHE_2_0_SHA256);
});

test('there is no LICENSE.md index and no LICENSES directory', () => {
  assert.equal(existsSync('LICENSE.md'), false);
  assert.equal(existsSync('LICENSES'), false);
});

// Walk the tree directly (no git): the tooling container has no .git.
const SKIP = new Set(['.git', 'node_modules', 'artifacts']);
function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (entry.isFile()) yield full;
  }
}

test('no file, hidden ones included, declares a CC BY SPDX identifier', () => {
  const offenders = [...files('.')].filter((file) => /SPDX-License-Identifier:\s*CC-BY/.test(readFileSync(file, 'latin1')));
  assert.deepEqual(offenders, []);
});
