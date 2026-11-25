// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const { parse } = createRequire(new URL('../.github/actions/semantic-release/package.json', import.meta.url))('yaml');
const read = path => readFileSync(join(root, path), 'utf8');
const wf = name => parse(read(`.github/workflows/${name}.yml`));
const expectedScopes = { contents: 'read', pages: 'write', 'id-token': 'write' };
const workflows = ['manual', 'manual-build', 'deploy-manual', 'release'];

test('normal push releases first and builds and deploys the manual from release outputs', () => {
  const r = wf('release').jobs;
  assert.equal(r.version, undefined);
  assert.equal(r.release.needs, 'verify');
  assert.equal(r.release.with['expected-version'], undefined);
  assert.equal(r.release.with['expected-commit'], undefined);
  assert.match(r.release.if, /vars\.RELEASES_ENABLED != 'false'/);
  assert.equal(r.manual.needs, 'release');
  assert.match(r.manual.if, /needs\.release\.outputs\.draft-created == 'true'/);
  assert.equal(r.manual.with.version, '${{ needs.release.outputs.version }}');
  assert.equal(r.manual.with.commit, '${{ needs.release.outputs.commit }}');
  assert.deepEqual(r['deploy-manual'].needs, ['release', 'publish-tooling', 'manual']);
  assert.match(r['deploy-manual'].if, /github.event_name == 'push'/);
  assert.match(r['deploy-manual'].if, /needs\.publish-tooling\.result == 'success'/);
  assert.match(r['deploy-manual'].if, /needs\.manual\.outputs\.artifact-id != ''/);
  assert.equal(r['deploy-manual'].with.artifact_id, '${{ needs.manual.outputs.artifact-id }}');
  const build = wf('manual-build').jobs.build;
  assert.deepEqual(build.permissions, { contents: 'read' });
  assert.deepEqual(build.steps.map(step => step.run).filter(run => run?.includes('task manual:')), ['task manual:verify']);
});

test('tooling recovery stays in release.yml and only the docs workflow exposes exact Pages replay', () => {
  const release = wf('release');
  assert.equal(release.on.workflow_dispatch, null);
  const manual = wf('manual');
  assert.equal(manual.on.push, undefined);
  assert.equal(manual.on.pull_request, null);
  assert.equal(manual.on.workflow_dispatch.inputs.replay_tag.required, true);
  assert.deepEqual(Object.values(manual.jobs).map(job => job.uses), [
    './.github/workflows/semantic-release-candidate.yml',
    './.github/workflows/manual-build.yml',
    './.github/workflows/deploy-manual.yml',
  ]);
  assert.match(release.jobs.release.if, /needs\.verify\.result == 'success'/);
  assert.match(manual.jobs['deploy-manual'].if, /github.event_name == 'workflow_dispatch'/);
  assert.match(manual.jobs['deploy-manual'].if, /github.ref == 'refs\/heads\/main'/);
  assert.match(manual.jobs['deploy-manual'].if, /inputs.replay_tag == format\('v\{0\}', needs.version.outputs.semver-version\)/);
  for (const [name, job] of Object.entries(manual.jobs)) {
    assert.deepEqual(job.permissions, name === 'deploy-manual' ? expectedScopes : { contents: 'read' });
  }
  for (const name of workflows) assert.doesNotMatch(read(`.github/workflows/${name}.yml`), /actions: write|actions: read|secrets: inherit/);
  const deploy = wf('deploy-manual').jobs.deploy;
  assert.deepEqual(deploy.permissions, expectedScopes);
  assert.equal(deploy.environment.name, 'github-pages');
  assert.match(deploy.steps.at(-2).run, /git\/ref\/heads\/main/);
  assert.match(deploy.steps.at(-1).uses, /^actions\/deploy-pages@/);
});

const command = (cwd, name, args) => execFileSync(name, args, { cwd, encoding: 'utf8' }).trim();

test('host passes the planned version and attempt into one credential-free manual container', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'guidelines-manual-docker-'));
  try {
    mkdirSync(join(sandbox, 'tools/manual'), { recursive: true });
    copyFileSync(join(root, 'tools/manual/container.sh'), join(sandbox, 'tools/manual/container.sh'));
    command(sandbox, 'git', ['init', '-q']);
    command(sandbox, 'git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture']);
    const bin = join(sandbox, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOG"\n[ "$1" != create ] || printf "%s\\n" fixture\n', { mode: 0o755 });
    const log = join(sandbox, 'test.log');
    const result = spawnSync('bash', ['tools/manual/container.sh', 'verify'], { cwd: sandbox, env: {
      PATH: `${bin}:${process.env.PATH}`, LOG: log, GITHUB_RUN_ID: '901', GITHUB_RUN_ATTEMPT: '2', MANUAL_VERSION: '9.9.3-pr.132.15.2', GH_TOKEN: 'not-forwarded',
    }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(log, 'utf8').split('\n');
    assert.equal(commands.filter(line => line.startsWith('build ')).length, 1);
    const create = commands.find(line => line.startsWith('create '));
    assert.match(create, /--network none -e GITHUB_RUN_ID=901 -e GITHUB_RUN_ATTEMPT=2 -e MANUAL_VERSION=9.9.3-pr.132.15.2/);
    assert.doesNotMatch(create, /GH_TOKEN|not-forwarded/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

const assetNames = ['tooling-index.json', 'tooling-image.json'];
const goodRelease = {
  tag_name: 'v9.9.3', draft: false, prerelease: false, immutable: true, published_at: 'fixture',
  assets: assetNames.map(name => ({ name, state: 'uploaded' })),
};

test('production shell gate requires exact verified tag and existing tooling release without writing', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'guidelines-manual-release-'));
  try {
    const git = (...args) => command(sandbox, 'git', args);
    git('init', '-q');
    const commit = () => git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
    commit();
    const original = git('rev-parse', 'HEAD');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'tag', '-a', 'v9.9.3', '-m', 'fixture');
    const tags = git('show-ref', '--tags');
    const bin = join(sandbox, 'bin');
    mkdirSync(bin);
    mkdirSync(join(sandbox, 'tools/manual'), { recursive: true });
    copyFileSync(join(root, 'tools/manual/check-release.mjs'), join(sandbox, 'tools/manual/check-release.mjs'));
    // Match the native tooling image's relevant runtime; never let the host
    // Python accidentally satisfy a production guard dependency.
    for (const program of ['bash', 'git']) {
      symlinkSync(command(sandbox, 'bash', ['-c', `command -v ${program}`]), join(bin, program));
    }
    symlinkSync(process.execPath, join(bin, 'node'));
    const noPython = spawnSync('bash', ['-c', '! command -v python3'], { env: { PATH: bin } });
    assert.equal(noPython.status, 0);
    writeFileSync(join(bin, 'gh'), '#!/bin/sh\n[ "$GH_TOKEN" = fixture ] || exit 2\n[ "$*" = "api repos/fixture/guidelines/releases/tags/v9.9.3" ] || exit 3\n[ -n "$FIXTURE_BODY" ] || exit 22\nprintf "%s\\n" "$FIXTURE_BODY"\n', { mode: 0o755 });
    const script = wf('deploy-manual').jobs.deploy.steps.find(step => step.name === 'Require exact published stable tag and same-run build').run;
    const env = {
      PATH: bin, GH_TOKEN: 'fixture', GITHUB_REPOSITORY: 'fixture/guidelines',
      GITHUB_EVENT_NAME: 'push', VERSION: '9.9.3', RELEASE_TAG: 'v9.9.3', ARTIFACT_ID: '13',
      SOURCE: original, GITHUB_SHA: original, PLAN_RUN: '32', GITHUB_RUN_ID: '32',
      PLAN_ATTEMPT: '1', GITHUB_RUN_ATTEMPT: '1', REPLAY_TAG: '',
      FIXTURE_BODY: JSON.stringify(goodRelease),
    };
    const result = changes => spawnSync('bash', ['-c', script], { cwd: sandbox, env: { ...env, ...changes }, encoding: 'utf8' });
    const first = result({});
    assert.equal(first.status, 0, first.stderr);
    assert.equal(result({ GITHUB_RUN_ATTEMPT: '2' }).status, 0, 'normal delivery-only rerun');
    assert.equal(result({ GITHUB_EVENT_NAME: 'workflow_dispatch', REPLAY_TAG: 'v9.9.3' }).status, 0, 'exact replay');
    const prebuild = wf('manual-build').jobs.build.steps.find(step => step.name === 'Require the existing immutable stable release before rebuilding').run;
    const rebuild = body => spawnSync('bash', ['-c', prebuild], { cwd: sandbox, env: {
      ...env, MANUAL_VERSION: '9.9.3', REPLAY_TAG: 'v9.9.3', FIXTURE_BODY: JSON.stringify(body),
    }, encoding: 'utf8' });
    const allowed = rebuild(goodRelease);
    assert.equal(allowed.status, 0, allowed.stderr);
    for (const body of [{draft: true}, {prerelease: true}, {immutable: false}, {tag_name: 'v9.9.2'}, {assets: []},
      {assets: [...goodRelease.assets, goodRelease.assets[0]]},
      {assets: [goodRelease.assets[0], {...goodRelease.assets[1], state: 'new'}]}]) {
      const invalid = { ...goodRelease, ...body };
      assert.notEqual(result({ FIXTURE_BODY: JSON.stringify(invalid) }).status, 0);
      assert.notEqual(rebuild(invalid).status, 0);
    }
    assert.notEqual(result({ FIXTURE_BODY: '' }).status, 0, 'no published release');
    assert.notEqual(result({ GITHUB_RUN_ID: '40' }).status, 0);
    assert.notEqual(result({ GITHUB_EVENT_NAME: 'workflow_dispatch', REPLAY_TAG: 'v9.9.2' }).status, 0);
    commit();
    const different = git('rev-parse', 'HEAD');
    assert.notEqual(result({ SOURCE: different, GITHUB_SHA: different }).status, 0, 'tag points elsewhere');
    assert.equal(git('show-ref', '--tags'), tags);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
