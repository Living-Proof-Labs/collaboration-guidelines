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

test('Health is Keel\'s area and the team stays out', () => {
  const health = section(read('docs/delivery-board.md'), 'Health');
  assert.match(health, /Health is Keel's area/);
  assert.match(health, /Keel owns the Health repositories/);
  assert.match(health, /merges Health pull requests himself,\s+with Codex/);
  assert.match(health, /rest of the team stays\s+out of those Health repositories and Health web views/);
  assert.match(health, /livingproof-health/);
  assert.match(health, /livingproof-evaluator-health/);
  assert.match(health, /verification-reports-action/);
  assert.match(health, /only bumps its Health evaluator reference/);
  assert.match(health, /team still owns everything else on a\s+published report/);
  assert.match(health, /does not make that report Keel-only/);
  assert.match(read('AGENTS.md'), /Health is Keel's area/);
  assert.match(section(read('docs/routine-check.md'), 'Lean repository coverage'),
    /Health is Keel's area; see \[Health\]\(delivery-board\.md#health\)/);
});

test('a review from Keel\'s Codex counts as independent review', () => {
  assert.match(read('docs/independent-review.md'),
    /A review from Keel's Codex counts as independent\s+review/);
  assert.match(section(read('docs/delivery-board.md'), 'Health'),
    /A review from Keel's Codex counts as\s+\[independent review\]/);
});

test('cost rules batch handoffs and leave verification depth to the verifier', () => {
  const cost = section(read('docs/routine-check.md'), 'Keep coordination cheap');
  assert.match(cost, /Aaron decided these cost rules on 2026-11-25 and 2026-11-28/);
  assert.match(cost, /Trading\s+some velocity for lower cost is fine/);
  assert.match(cost, /Do not name a depth when asking for a check/);
  assert.match(cost, /one message per agent per round/);
  assert.match(cost, /A wake is a\s+pointer, not a brief/);
  assert.match(cost, /continue until your queue is empty/);
  assert.match(cost, /do not restate them in the\s+message/);
  assert.match(cost, /need no action/);
  assert.match(cost, /acknowledgements, thanks, or "on it" replies/);
  assert.match(cost, /a board move\s+or a GitHub comment is the acknowledgement/);
  assert.match(cost, /Report back to the\s+engineering lead once, when the lead must act/);
  assert.match(cost, /Progress goes on\s+the pull request/);
  assert.match(cost, /check running work when it reports back/);
  assert.match(cost, /\[Blocker detection\]\(#blocker-detection\) is the exception/);
  assert.match(cost, /GitHub is where agents talk/);
  assert.match(cost, /not in agent-to-agent messages/);
  assert.match(cost, /keep working their board queue without being prompted/);
  assert.match(cost, /Do not wake an agent whose top\s+item already shows recent activity/);
  assert.match(cost, /read the verdict there instead\s+of asking for it again/);
  assert.match(cost, /board\s+field change plus a GitHub comment already does the job/);
  const light = section(read('docs/independent-review.md'), 'Match verification depth to risk');
  assert.match(light, /chores, and post-merge checks/);
  assert.doesNotMatch(light, /explicitly marked Deep/);
  assert.match(section(read('docs/delivery-board.md'), 'Roles and queues'),
    /On a handoff round/);
});

test('taking a Gemini item sets In Progress with the lead as Owner right away', () => {
  const doc = read('docs/routine-check.md');
  const start = doc.indexOf('### Gemini handoff\n');
  assert.notEqual(start, -1);
  const end = doc.indexOf('\n## ', start + 1);
  const handoff = doc.slice(start, end === -1 ? undefined : end);
  assert.match(handoff, /set it\s+to \*\*In Progress\*\* with Owner the engineering lead right away/);
  assert.match(handoff, /Do not\s+leave Owner as Gemini/);
  assert.doesNotMatch(handoff, /Status \*\*In Review\*\*/);
  assert.match(section(read('docs/delivery-board.md'), 'Roles and queues'),
    /setting \*\*In Progress\*\* with Owner the lead right away/);
});

test('a partial pull request uses Refs, not Closes', () => {
  for (const [file, body] of [
    ['AGENTS.md', read('AGENTS.md')],
    ['CONTRIBUTING.md', read('CONTRIBUTING.md')],
    ['docs/delivery-board.md', section(read('docs/delivery-board.md'), 'Capture every piece of work')],
  ]) {
    assert.match(body, /uses\s+`Refs #N`/, file);
    assert.match(body, /not `Closes #N`/, file);
    assert.match(body, /reopen the\s+issue/, file);
    assert.match(body, /merge queue\s+uses merge\s+commits/, file);
    assert.match(body, /description or in a\s+commit message/, file);
  }
});

test('README excerpts point at real files and public reports are not fixtures', () => {
  assert.match(section(read('docs/documentation-recipe.md'), 'Consistent navigation'),
    /Excerpts and links in a README point at real files[\s\S]{0,200}Public reports\s+never show fixture or mock runs/);
  assert.match(section(read('docs/releases.md'), 'Integration through released tags'),
    /Public reports never\s+show fixture or mock runs/);
  assert.match(read('AGENTS.md'),
    /Excerpts and links in a README point at real files; public reports never\s+show fixture or mock runs/);
});
