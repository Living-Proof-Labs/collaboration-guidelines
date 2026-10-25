// SPDX-License-Identifier: Apache-2.0
// Node's JUnit reporter emits top-level test cases without this suite; the
// provider's JUnit parser requires them inside a testsuite element.
import { describe } from 'node:test';
import { readdir } from 'node:fs/promises';
describe('Guidelines and host checks', async () => {
  const directory = new URL('../../.github/actions/semantic-release/test/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.test.mjs')).sort()) {
    await import(new URL(name, directory));
  }
  await import('./test.mjs');
});
