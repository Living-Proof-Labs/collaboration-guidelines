// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const section = (text, heading) => {
  const start = text.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
};

test('routine check detects blockers on every in-progress item', () => {
  const doc = read('docs/routine-check.md');
  const rule = section(doc, 'Blocker detection');
  assert.match(rule, /every item in progress, not only items\s+Aaron asked about/);
  assert.match(rule, /\*\*In Progress\*\* or\s+\*\*Verifying Pull Request\*\*/);
  assert.match(rule, /failing required check/);
  assert.match(rule, /about an hour or more/);
  assert.match(rule, /one priority message/);
  assert.match(rule, /takes the item over/);
  assert.match(rule, /Owner \*\*Aaron\*\*, assign `aroller`, and add an evidence comment/);
  assert.match(rule, /Do not re-ping the same stall/);
  assert.match(rule, /escalate one step/);
  assert.match(rule, /run summary/);
  assert.match(rule, /overrides any pacing guidance/);
  assert.match(section(doc, 'Scheduled check scope'), /\[Blocker detection\]\(#blocker-detection\)/);
});

test('pacing guidance points at the blocker-detection exception', () => {
  const doc = read('docs/routine-check.md');
  const running = doc.split('\n').find((l) => l.startsWith('| Already-running worker |'));
  assert.match(running, /\[Blocker detection\]\(#blocker-detection\)/);
  assert.match(section(doc, 'Dispatch, collect, and checkpoint'), /does not pause\s+\[Blocker detection\]/);
  assert.match(section(doc, 'Event wakes (issue or pull request)'), /lists every stalled\s+item found by \[Blocker detection\]/);
  assert.match(section(read('docs/delivery-board.md'), 'Status check'),
    /\[Blocker detection\]\(routine-check\.md#blocker-detection\)/);
});
