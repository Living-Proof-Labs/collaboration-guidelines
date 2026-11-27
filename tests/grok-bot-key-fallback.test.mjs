// SPDX-License-Identifier: Apache-2.0
// The Grok Bot setup page must keep the on-box key file fallback (27 Nov 2026 secret loss).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/platforms/grok-bot.md', import.meta.url), 'utf8');
const section = (heading) => {
  const start = page.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const end = page.indexOf('\n## ', start + 1);
  return page.slice(start, end === -1 ? undefined : end);
};

test('setup requires a mode-600 key file the helper falls back to', () => {
  const s = section('Credentials and connectors');
  assert.match(s, /~\/\.config\/lpl\/<role>-app\.pem/);
  assert.match(s, /`0600`/);
  assert.match(s, /falls back to that file/);
  assert.match(s, /Never commit or print the key/);
});

test('self-check tests the helper with the env secret unset', () => {
  assert.match(section('Setup self-check'), /env -u <ROLE>_GITHUB_APP_PRIVATE_KEY python3 <helper>/);
});

test('troubleshooting covers a vanished secret, the secret card, and the routine pause', () => {
  const s = section('When a key secret vanishes');
  assert.match(s, /key file keeps the role working/);
  assert.match(s, /secret\s+card/);
  assert.match(s, /pauses itself\s+after two hourly runs/);
});
