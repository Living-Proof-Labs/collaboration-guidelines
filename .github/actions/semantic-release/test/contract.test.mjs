// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import YAML from 'yaml';
import { run } from '../run.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const buildOutputs = ['semver-version', 'pep440-version', 'debian-version'];
const provenance = ['run-id', 'run-attempt'];

test('workflow and action preserve one source pin and output wiring', async () => {
  const workflow = YAML.parse(await read('.github/workflows/semantic-release.yml'));
  const action = YAML.parse(await read('.github/actions/semantic-release/action.yml'));
  const job = workflow.jobs.release;
  assert.equal(job.steps[1].uses, '$/.github/actions/semantic-release');
  assert.equal(job.steps[0].with['fetch-depth'], 0);
  assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.equal(job.permissions.contents, 'write');
  assert.equal(job.concurrency['cancel-in-progress'], false);
  assert.equal(action.runs.using, 'composite');
  for (const key of ['published', 'draft-created', 'version', 'git-tag', 'release-url', 'commit']) {
    assert.equal(workflow.on.workflow_call.outputs[key].value, `\${{ jobs.release.outputs.${key} }}`);
    assert.equal(job.outputs[key], `\${{ steps.release.outputs.${key} }}`);
    assert.equal(action.outputs[key].value, `\${{ steps.release.outputs.${key} }}`);
  }
  for (const [input, variable] of [
    ['expected-version', 'RELEASE_WRITER_EXPECTED_VERSION'],
    ['expected-commit', 'RELEASE_WRITER_EXPECTED_COMMIT'],
  ]) {
    assert.equal(workflow.on.workflow_call.inputs[input].type, 'string');
    assert.equal(workflow.on.workflow_call.inputs[input].default, '');
    assert.equal(job.steps[1].with[input], `\${{ inputs.${input} }}`);
    assert.equal(action.inputs[input].required, false);
    assert.equal(action.runs.steps[2].env[variable], `\${{ inputs.${input} }}`);
  }
  for (const key of [...buildOutputs, ...provenance, 'build-version']) {
    assert.ok(!Object.hasOwn(job.outputs, key));
    assert.ok(!Object.hasOwn(workflow.on.workflow_call.outputs, key));
  }
  assert.ok(!Object.hasOwn(action.outputs, 'build-version'));
  const own = YAML.parse(await read('.github/workflows/release.yml'));
  assert.deepEqual(own.jobs.release.needs, ['verify', 'version', 'manual']);
  assert.equal(own.jobs.release.uses, './.github/workflows/semantic-release.yml');
  assert.deepEqual(own.on.push.branches, ['main']);
});
test('relative documentation links and adoption pin examples resolve structurally', async () => {
  for (const path of ['README.md', 'AGENTS.md', 'CONTRIBUTING.md',
    'docs/tool-usability.md', 'templates/generated-docs/README.md', '.github/GENERATED-DOCS.md',
    'docs/documentation-recipe.md', 'docs/documentation-ownership.md', 'docs/manual.md',
    'docs/shared-host.md', '.codex/DEVELOPMENT.md', '.cursor/DEVELOPMENT.md',
    '.gemini/DEVELOPMENT.md',
    'docs/releases.md', 'docs/licensing.md', 'docs/developer-interface.md',
    'docs/delivery-board.md',
    '.github/SETTINGS.md', '.github/DEVELOPMENT.md',
    '.gitlab/DEVELOPMENT.md']) {
    const body = await read(path);
    for (const [, link] of body.matchAll(/\]\(([^)]+)\)/g)) {
      if (!/^https?:/.test(link)) await access(resolve(root, dirname(path), link.split('#')[0]));
    }
  }
  const example = (await read('docs/releases.md')).match(/```yaml\n([\s\S]*?)\n```/)[1];
  const replaced = YAML.parse(example);
  assert.match(replaced.jobs.release.uses, /semantic-release\.yml@v\d+\.\d+\.\d+$/);
  assert.equal(replaced.jobs.release.needs, 'verify');
});
test('adapter refuses unsupported inputs or non-main execution before publishing', async () => {
  const old = { dry: process.env.RELEASE_DRY_RUN, ref: process.env.GITHUB_REF };
  try {
    process.env.RELEASE_DRY_RUN = 'perhaps';
    await assert.rejects(run(), /dry-run must be/);
    process.env.RELEASE_DRY_RUN = 'false';
    process.env.GITHUB_REF = 'refs/pull/2/merge';
    await assert.rejects(run(), /Release must run from main/);
  } finally {
    for (const [key, value] of [['RELEASE_DRY_RUN', old.dry], ['GITHUB_REF', old.ref]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('draft release is opt-in and reaches the official action input', async () => {
  const workflow = YAML.parse(await read('.github/workflows/semantic-release.yml'));
  const action = YAML.parse(await read('.github/actions/semantic-release/action.yml'));
  assert.equal(workflow.on.workflow_call.inputs['draft-release'].default, false);
  assert.equal(workflow.jobs.release.steps[1].with['draft-release'], '${{ inputs.draft-release }}');
  assert.equal(action.inputs['draft-release'].default, 'false');
  assert.equal(action.runs.steps[2].env.RELEASE_DRAFT, '${{ inputs.draft-release }}');
});

test('candidate is a separately callable read-only workflow with no release token', async () => {
  const candidate = YAML.parse(await read('.github/workflows/semantic-release-candidate.yml'));
  assert.deepEqual(Object.keys(candidate.on), ['workflow_call']);
  assert.deepEqual(Object.keys(candidate.on.workflow_call.inputs), ['replay-tag']);
  assert.deepEqual(Object.keys(candidate.jobs), ['candidate']);
  assert.deepEqual(candidate.permissions, { contents: 'read' });
  const job = candidate.jobs.candidate;
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.match(job.if, /github.event_name == 'pull_request'.*github.base_ref == 'main'/);
  assert.match(job.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(job.if, /github.event_name == 'push'.*github.event_name == 'workflow_dispatch'/);
  assert.equal(job.steps[0].with.ref, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.equal(job.steps[0].with['fetch-depth'], 0);
  assert.equal(job.steps[1].env.BASE_REPOSITORY, '${{ github.event.pull_request.base.repo.full_name }}');
  assert.match(job.steps[1].run, /"\$BASE_REPOSITORY" == "\$GITHUB_REPOSITORY"/);
  assert.equal(job.steps[1].if, "github.event_name == 'pull_request'");
  assert.deepEqual(job.steps[2].with, {
    'dry-run': true,
    candidate: "${{ github.event_name == 'pull_request' }}",
    'plan-only': true,
    'replay-tag': '${{ inputs.replay-tag }}',
    'replay-read-token': "${{ github.event_name == 'workflow_dispatch' && inputs.replay-tag != '' && github.token || '' }}",
  });
  assert.equal(job.steps[2].uses, '$/.github/actions/semantic-release');
  const action = YAML.parse(await read('.github/actions/semantic-release/action.yml'));
  assert.equal(action.runs.steps[2].env.RELEASE_EXPECTED_BASE, '${{ github.event.pull_request.base.sha }}');
  assert.equal(action.runs.steps[2].env.RELEASE_PR_NUMBER, '${{ github.event.pull_request.number }}');
  assert.deepEqual(Object.keys(candidate.on.workflow_call.outputs), [...buildOutputs, 'version', 'git-tag', 'commit', ...provenance]);
  for (const key of [...buildOutputs, ...provenance]) {
    assert.equal(candidate.on.workflow_call.outputs[key].value, `\${{ jobs.candidate.outputs.${key} }}`);
    assert.equal(job.outputs[key], `\${{ steps.plan.outputs.${key} }}`);
  }
});

test('ordinary PRs exercise the read-only callable and validate its hosted candidate outputs', async () => {
  const verify = YAML.parse(await read('.github/workflows/verify.yml'));
  const call = verify.jobs['release-candidate'];
  assert.deepEqual(call, {
    if: "github.event_name == 'pull_request' && github.base_ref == 'main'",
    permissions: { contents: 'read' },
    uses: './.github/workflows/semantic-release-candidate.yml',
  });
  const check = verify.jobs['release-candidate-contract'];
  assert.equal(check.if, `always() && ${call.if}`);
  assert.equal(check.needs, 'release-candidate');
  assert.deepEqual(check.permissions, {});
  assert.equal(check.steps.length, 1);
  const step = check.steps[0];
  assert.deepEqual(step.env, {
    RESULT: '${{ needs.release-candidate.result }}',
    EXPECTED_HEAD: '${{ github.event.pull_request.head.sha }}',
    CANDIDATE_COMMIT: '${{ needs.release-candidate.outputs.commit }}',
    CANDIDATE_VERSION: '${{ needs.release-candidate.outputs.version }}',
    CANDIDATE_TAG: '${{ needs.release-candidate.outputs.git-tag }}',
    SEMVER_VERSION: '${{ needs.release-candidate.outputs.semver-version }}',
    PEP440_VERSION: '${{ needs.release-candidate.outputs.pep440-version }}',
    DEBIAN_VERSION: '${{ needs.release-candidate.outputs.debian-version }}',
    PR_NUMBER: '${{ github.event.pull_request.number }}',
    CALLER_RUN_NUMBER: '${{ github.run_number }}',
    CALLER_RUN_ID: '${{ github.run_id }}',
    CALLER_RUN_ATTEMPT: '${{ github.run_attempt }}',
    PLAN_RUN_ID: '${{ needs.release-candidate.outputs.run-id }}',
    PLAN_RUN_ATTEMPT: '${{ needs.release-candidate.outputs.run-attempt }}',
  });
  const head = 'a'.repeat(40);
  const checkOutput = overrides => spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, RESULT: 'success', EXPECTED_HEAD: head, CANDIDATE_COMMIT: head,
      CANDIDATE_VERSION: '9.8.0', CANDIDATE_TAG: 'v9.8.0',
      SEMVER_VERSION: '9.8.0-pr.131.42.1',
      PEP440_VERSION: '9.8.0.dev420000000000000001234500000000000000000001', DEBIAN_VERSION: '9.8.0~pr.131.42.1',
      PR_NUMBER: '131', CALLER_RUN_NUMBER: '42', CALLER_RUN_ID: '12345', CALLER_RUN_ATTEMPT: '1', PLAN_RUN_ID: '12345', PLAN_RUN_ATTEMPT: '1', ...overrides },
  });
  assert.match(checkOutput({}).stdout, /Release candidate 9\.8\.0 \(v9\.8\.0\)/);
  assert.match(checkOutput({ CANDIDATE_VERSION: '', CANDIDATE_TAG: '' }).stdout, /No release due/);
  for (const invalid of [
    { RESULT: 'skipped' },
    { CANDIDATE_COMMIT: '' },
    { CANDIDATE_COMMIT: 'b'.repeat(40) },
    { CANDIDATE_VERSION: '' },
    { CANDIDATE_TAG: '' },
    { CANDIDATE_TAG: 'v9.8.1' },
    { SEMVER_VERSION: '' }, { SEMVER_VERSION: '9.8.0' },
    { SEMVER_VERSION: '9.8.0-pr.131.43.1' }, { CALLER_RUN_NUMBER: '43' },
    { CALLER_RUN_ATTEMPT: '2' }, { CALLER_RUN_ATTEMPT: '01' },
    { PLAN_RUN_ID: '54321' }, { PLAN_RUN_ATTEMPT: '2' },
    { SEMVER_VERSION: '9.8.0' }, { PEP440_VERSION: '9.8.0.dev42' },
    { DEBIAN_VERSION: '9.8.0~pr.131.42.1-1' }, { CALLER_RUN_ID: '12346' },
    { CANDIDATE_VERSION: '09.8.0', CANDIDATE_TAG: 'v09.8.0' },
  ]) assert.equal(checkOutput(invalid).status, 1);
});
