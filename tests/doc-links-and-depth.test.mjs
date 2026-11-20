// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = ['AGENTS.md', 'CONTRIBUTING.md', 'README.md',
  ...readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)]
  .filter((f) => existsSync(join(root, f)));

const slug = (h) => h.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
const anchors = (text) => new Set([...text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => slug(m[1])));

test('relative markdown links and anchors resolve', () => {
  const bad = [];
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const [target, frag] = m[1].split('#');
      if (/^[a-z]+:/i.test(m[1])) continue;
      const path = target ? resolve(root, dirname(f), target) : join(root, f);
      if (!existsSync(path)) { bad.push(`${f}: missing ${m[1]}`); continue; }
      if (frag && path.endsWith('.md') && !anchors(readFileSync(path, 'utf8')).has(frag)) bad.push(`${f}: missing anchor ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the verifier, not the requester, chooses the verification depth', () => {
  const stale = /(name the (verification )?depth (\(.*\) )?in each|names the depth in each|If none is named|Light by default|Light is the default\. A changed|coordinator.{0,40}(sets|names|chooses) (the )?(depth|tier))/i;
  const hits = [];
  for (const f of [...files, '.codex', '.cursor', '.gemini', '.github', '.gitlab']) {
    const p = join(root, f);
    if (!f.endsWith('.md')) continue;
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (stale.test(l)) hits.push(`${f}:${i + 1}: ${l.trim()}`); });
  }
  assert.deepEqual(hits, []);
});
