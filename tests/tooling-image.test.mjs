// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../.github/actions/semantic-release/package.json', import.meta.url));
const YAML = require('yaml');
const root = resolve(import.meta.dirname, '..');
const read = p => readFileSync(join(root, p), 'utf8');

test('tooling uses native architectures and tests exact archives before release publication', () => {
  const workflow = YAML.parse(read('.github/workflows/tooling-image.yml'));
  const build = workflow.jobs.build;
  assert.deepEqual(build.strategy.matrix.include.map(x => x.arch), ['amd64', 'arm64']);
  assert.equal(build.strategy.matrix.include[1].runner, 'ubuntu-24.04-arm');
  const script = build.steps[1].run;
  assert.ok(script.indexOf('docker run --rm "$image" task verify') < script.indexOf('docker save'));
  assert.equal(workflow.permissions.contents, 'read');
  const verify = YAML.parse(read('.github/workflows/verify.yml'));
  assert.equal(verify.jobs['tooling-image'].uses, './.github/workflows/tooling-image.yml');
  const release = YAML.parse(read('.github/workflows/release.yml')).jobs;
  assert.deepEqual(release['publish-tooling'].needs, ['verify', 'release']);
  assert.equal(release['publish-tooling'].if, "needs.release.outputs.published == 'true'");
  assert.equal(release['publish-tooling'].permissions.packages, 'write');
  assert.equal(release['publish-tooling'].concurrency['cancel-in-progress'], false);
  assert.match(read('Dockerfile'), /COPY tools\/tooling\/install-task.sh/);
});

function publish(mode = 'ok') {
  const dir = mkdtempSync(join(tmpdir(), 'tooling-image-'));
  mkdirSync(join(dir, 'bin'));
  mkdirSync(join(dir, 'tooling-candidate'));
  mkdirSync(join(dir, 'tools/tooling'), { recursive: true });
  copyFileSync(join(root, 'tools/tooling/record-index.mjs'), join(dir, 'tools/tooling/record-index.mjs'));
  const log = join(dir, 'calls');
  const digest = 'sha256:' + 'a'.repeat(64);
  writeFileSync(join(dir, 'bin/docker'), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$1 \${2:-}" in
  'login ghcr.io'|'load ') cat >/dev/null ;;
  'manifest inspect')
    case "$MODE" in
      existing) exit 0 ;;
      auth) echo 'unauthorized' >&2; exit 1 ;;
      *) echo 'no such manifest' >&2; exit 1 ;;
    esac ;;
  'image inspect')
    if [[ "$4" == *Architecture* ]]; then
      if [[ "$MODE" == wrongarch ]]; then echo mips; else echo "\${5##*-}"; fi
    elif [[ "$MODE" == wrongrevision ]]; then echo stale; else echo abc123; fi ;;
  push*)
    if [[ "$MODE" == partial && "$2" == *-arm64 ]]; then echo 'registry unavailable' >&2; exit 1; fi ;;
  'buildx imagetools')
    if [[ "$4" == *-amd64 || "$4" == *-arm64 ]]; then
      if [[ "$MODE" == wrongchild ]]; then echo '{"digest":"sha256:${'d'.repeat(64)}"}';
      elif [[ "$4" == *-amd64 ]]; then echo '{"digest":"sha256:${'b'.repeat(64)}"}';
      else echo '{"digest":"sha256:${'c'.repeat(64)}"}'; fi
    elif [[ "$MODE" == badindex ]]; then echo '{}'; else
      echo '${JSON.stringify({ digest, manifests: ['amd64', 'arm64'].map(architecture => ({ digest: 'sha256:' + (architecture === 'amd64' ? 'b' : 'c').repeat(64), platform: { os: 'linux', architecture } })) })}'
    fi ;;
esac
`, { mode: 0o755 });
  writeFileSync(join(dir, 'bin/gh'), '#!/usr/bin/env bash\nprintf "gh %s\\n" "$*" >> "$CALL_LOG"\n', { mode: 0o755 });
  for (const arch of ['amd64', 'arm64']) {
    const bytes = gzipSync('exact-tested-image');
    writeFileSync(join(dir, 'tooling-candidate', `${arch}.tar.gz`), bytes);
    const sha = mode === 'corrupt' ? 'b'.repeat(64) : createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(dir, 'tooling-candidate', `${arch}.sha256`), `${sha}  ${arch}.tar.gz\n`);
  }
  const result = spawnSync('bash', [join(root, 'tools/tooling/publish.sh')], {
    cwd: dir, encoding: 'utf8', env: { ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, MODE: mode, CALL_LOG: log,
      GH_TOKEN: 'test-not-a-credential', GITHUB_REPOSITORY: 'Living-Proof-Labs/collaboration-guidelines',
      GITHUB_SHA: 'abc123', GITHUB_ACTOR: 'test', RELEASE_TAG: mode === 'badtag' ? 'latest' : 'v1.2.3',
      GITHUB_STEP_SUMMARY: join(dir, 'summary'),
    },
  });
  let calls = '';
  try { calls = readFileSync(log, 'utf8'); } catch { /* Invalid tag fails before Docker. */ }
  let evidence;
  try { evidence = JSON.parse(readFileSync(join(dir, 'artifacts/tooling-image.json'), 'utf8')); } catch { /* Failure path. */ }
  rmSync(dir, { recursive: true, force: true });
  return { ...result, calls, evidence };
}

test('publishes tested images, records multiarch index digest, uploads immutable evidence', () => {
  const result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.evidence.reference, /:v1.2.3@sha256:a{64}$/);
  assert.deepEqual(result.evidence.platforms, ['linux/amd64', 'linux/arm64']);
  assert.equal((result.calls.match(/^push /gm) || []).length, 2);
  assert.match(result.calls, /gh release upload v1.2.3/);
  assert.doesNotMatch(result.calls, /--clobber|latest/);
});
for (const mode of ['existing', 'auth', 'corrupt', 'wrongarch', 'wrongrevision', 'badtag']) {
  test(`refuses publication before writes: ${mode}`, () => {
    const result = publish(mode);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.calls, /^push |^manifest create |gh release upload/m);
  });
}
test('invalid published index is not advertised as verified evidence', () => {
  const result = publish('badindex');
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence, undefined);
  assert.doesNotMatch(result.calls, /gh release upload/);
});

test('partial push failure never publishes the index or successful release evidence', () => {
  const result = publish('partial');
  assert.notEqual(result.status, 0);
  assert.equal((result.calls.match(/^push /gm) || []).length, 2);
  assert.doesNotMatch(result.calls, /^manifest create |^manifest push |gh release upload/m);
  assert.equal(result.evidence, undefined);
});
test('index child digests must agree with the published architecture tags', () => {
  const result = publish('wrongchild');
  assert.notEqual(result.status, 0);
  assert.equal(result.evidence, undefined);
  assert.doesNotMatch(result.calls, /gh release upload/);
});
