// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import YAML from 'yaml';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (path) => readFile(resolve(root, path), 'utf8');

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  assert.ok(match, `expected a Node version, got ${value}`);
  return match.slice(1).map(Number);
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

// npm engines: a bare version is exact, and a leading v is ignored.
function satisfies(version, range) {
  const actual = parseVersion(version);
  return String(range).trim().split(/\s+/).every((constraint) => {
    const exact = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(constraint);
    if (exact) return compare(actual, exact.slice(1).map(Number)) === 0;
    const compared = /^(>=|<=|>|<|=)v?(\d+\.\d+\.\d+)$/.exec(constraint);
    assert.ok(compared, `unsupported engines range: ${range}`);
    const cmp = compare(actual, parseVersion(compared[2]));
    if (compared[1] === '>=') return cmp >= 0;
    if (compared[1] === '<=') return cmp <= 0;
    if (compared[1] === '>') return cmp > 0;
    if (compared[1] === '<') return cmp < 0;
    return cmp === 0;
  });
}

function nodeVersions(document) {
  const found = [];
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'node-version')) found.push(String(value['node-version']));
    for (const child of Object.values(value)) walk(child);
  };
  walk(document);
  return found;
}

test('engines.node accepts the Node version installed by the action and verify workflow', async () => {
  const manifest = JSON.parse(await read('.github/actions/semantic-release/package.json'));
  const lock = JSON.parse(await read('.github/actions/semantic-release/package-lock.json'));
  const required = manifest.engines.node;
  assert.equal(lock.packages[''].engines.node, required);
  const action = nodeVersions(YAML.parse(await read('.github/actions/semantic-release/action.yml')));
  const verify = nodeVersions(YAML.parse(await read('.github/workflows/verify.yml')));
  assert.ok(action.length > 0, 'action.yml must install a node-version');
  assert.ok(verify.length > 0, 'verify.yml must install a node-version');
  for (const version of [...action, ...verify]) {
    assert.equal(satisfies(version, required), true, `${version} does not satisfy engines.node ${required}`);
  }
});
