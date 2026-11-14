// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const self = fileURLToPath(import.meta.url);

const removedFiles = [
  'config/github/repository-policy.json',
  'tests/github/repository-settings.test.mjs',
  'tools/github/repository-settings.mjs'
];

const removedNames = [
  'config/github/repository-policy.json',
  'tests/github/repository-settings.test.mjs',
  'tools/github/repository-settings.mjs',
  'github:settings:test'
];

// The stub SETTINGS.md keeps the top heading, so #github-repository-settings
// remains valid. These anchors belonged to sections that this cleanup removed.
const removedAnchors = [
  'managed-defaults-and-change-control',
  'recommended-main-protection',
  'github-pages',
  'releases-and-workflows',
  'repository-policy',
  'apply-the-pinned-policy',
  'exit-status',
  'token',
  'repin-after-this-file-changes',
  'consumer-inventory',
  'explicit-owner-preferences',
  'other-observed-choices',
  'authenticated-browser-observations',
  'general-settings',
  'actions-settings',
  'runners-and-actions-policies',
  'evidence-and-inspection-limits',
  'supporting-other-providers'
];

const textFile = /\.(md|mjs|js|cjs|yml|yaml|json|sh|py|toml|txt|css|html|in)$/i;

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.tools' || entry.name === '.task') {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (textFile.test(entry.name)) yield path;
  }
}

test('retired settings sources stay removed and unreferenced', async () => {
  for (const file of removedFiles) {
    assert.equal(existsSync(join(root, file)), false, `removed file still present: ${file}`);
  }

  const hits = [];
  const anchorPattern = new RegExp(
    String.raw`SETTINGS\.(md|html)#(?:${removedAnchors.join('|')})\b`,
    'i'
  );
  for await (const path of walk(root)) {
    if (path === self) continue;
    const body = await readFile(path, 'utf8');
    const rel = relative(root, path);
    for (const name of removedNames) {
      if (body.includes(name)) hits.push(`${rel}: ${name}`);
    }
    const match = body.match(anchorPattern);
    if (match) hits.push(`${rel}: ${match[0]}`);
  }
  assert.deepEqual(hits, [], `leftover references to retired settings sources:\n${hits.join('\n')}`);
});
