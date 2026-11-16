// SPDX-License-Identifier: Apache-2.0
// The repository's own Renovate preset pin, checked by shape and by a floor rather
// than one frozen version (Vera review of #86; replaces the v9.4.0-only check from
// #84, which went stale on the next bump). v9.5.0 is the first release with
// rebaseWhen: "conflicted" (.github#103), so the self-pin must not go below it.
// LIVINGPROOF_NETWORK=1 also reads the pinned release and its preset.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const REPO = 'Living-Proof-Labs/collaboration-guidelines';
const PIN = /^github>Living-Proof-Labs\/collaboration-guidelines:renovate-preset#v(\d+)\.(\d+)\.(\d+)$/;
const FLOOR = [9, 5, 0];
const config = JSON.parse(readFileSync(path.join(root, 'renovate.json'), 'utf8'));
const preset = JSON.parse(readFileSync(path.join(root, 'renovate-preset.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(root, 'docs-brand.lock.json'), 'utf8'));
const skipNetwork = process.env.LIVINGPROOF_NETWORK ? false : 'set LIVINGPROOF_NETWORK=1';

function pinnedVersion() {
  const pins = (config.extends ?? []).filter(entry => entry.startsWith(`github>${REPO}:`));
  assert.equal(pins.length, 1, `expected one guidelines preset pin, got ${JSON.stringify(pins)}`);
  const match = PIN.exec(pins[0]);
  assert.ok(match, `${pins[0]} is not a full vX.Y.Z release tag`);
  return match.slice(1).map(Number);
}

function atLeast(version, floor) {
  for (let i = 0; i < 3; i += 1) {
    if (version[i] !== floor[i]) return version[i] > floor[i];
  }
  return true;
}

test('the only guidelines preset pin is a full release tag at or above v9.5.0', () => {
  const version = pinnedVersion();
  assert.ok(atLeast(version, FLOOR), `v${version.join('.')} is below v${FLOOR.join('.')}`);
  assert.equal(atLeast([9, 4, 9], FLOOR), false);
  assert.equal(atLeast([10, 0, 0], FLOOR), true);
});

test('the shared preset keeps docs-brand updates disabled and the brand lock stays pinned', () => {
  const brandRules = preset.packageRules.filter(rule => (rule.matchDepTypes ?? []).includes('docs-brand'));
  assert.equal(brandRules.length, 1);
  assert.equal(brandRules[0].enabled, false);
  assert.equal(lock.repository, REPO);
  assert.match(lock.version, /^v\d+\.\d+\.\d+$/);
  assert.match(lock.commit, /^[0-9a-f]{40}$/);
  assert.match(lock.sha256, /^[0-9a-f]{64}$/);
});

test('the working-tree preset automerges non-major updates and holds majors and docs-brand for review', () => {
  assert.equal(preset.automerge, true);
  assert.equal(preset.platformAutomerge, true);
  const major = preset.packageRules.filter(rule => (rule.matchUpdateTypes ?? []).includes('major'));
  assert.equal(major.length, 1);
  assert.deepEqual(major[0].matchUpdateTypes, ['major']);
  assert.equal(major[0].automerge, false);
  assert.equal(major[0].platformAutomerge, false);
  assert.equal(Object.prototype.hasOwnProperty.call(major[0], 'schedule'), false);
  const brand = preset.packageRules.filter(rule => (rule.matchDepTypes ?? []).includes('docs-brand'));
  assert.equal(brand.length, 1);
  assert.equal(brand[0].enabled, false);
  assert.equal(brand[0].automerge, false);
  assert.equal(brand[0].platformAutomerge, false);
  const internal = preset.packageRules.at(-1);
  assert.match(internal.description, /Living Proof Labs releases/);
  assert.deepEqual(internal.schedule, ['at any time']);
  assert.equal(Object.prototype.hasOwnProperty.call(internal, 'automerge'), false);
});

test('the pinned release is published and its preset matches the adopted automerge policy', { skip: skipNetwork }, async () => {
  const tag = `v${pinnedVersion().join('.')}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const release = await (await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, { headers })).json();
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  const raw = await fetch(`https://api.github.com/repos/${REPO}/contents/renovate-preset.json?ref=${tag}`, {
    headers: { ...headers, Accept: 'application/vnd.github.raw' },
  });
  assert.equal(raw.status, 200);
  const pinned = await raw.json();
  assert.equal(pinned.rebaseWhen, 'conflicted');
  // v9.6.0 first enables non-major automerge. Earlier supported pins
  // retain their published policy until the consumer deliberately adopts it.
  const automerge = atLeast(pinnedVersion(), [9, 6, 0]);
  assert.equal(pinned.automerge, automerge);
  assert.equal(pinned.platformAutomerge, automerge);
  if (automerge) {
    const major = pinned.packageRules.filter(rule => (rule.matchUpdateTypes ?? []).includes('major'));
    assert.equal(major.length, 1);
    assert.equal(major[0].automerge, false);
    assert.equal(major[0].platformAutomerge, false);
    const brand = pinned.packageRules.filter(rule => (rule.matchDepTypes ?? []).includes('docs-brand'));
    assert.equal(brand.length, 1);
    assert.equal(brand[0].enabled, false);
    assert.equal(brand[0].automerge, false);
    assert.equal(brand[0].platformAutomerge, false);
  }
});
