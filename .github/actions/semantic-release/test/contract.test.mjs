// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import YAML from 'yaml';
import { run } from '../run.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');

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
  for (const key of ['published', 'draft-created', 'version', 'git-tag', 'release-url']) {
    assert.equal(workflow.on.workflow_call.outputs[key].value, `\${{ jobs.release.outputs.${key} }}`);
    assert.equal(job.outputs[key], `\${{ steps.release.outputs.${key} }}`);
    assert.equal(action.outputs[key].value, `\${{ steps.release.outputs.${key} }}`);
  }
  const own = YAML.parse(await read('.github/workflows/release.yml'));
  assert.equal(own.jobs.release.needs, 'verify');
  assert.equal(own.jobs.release.uses, './.github/workflows/semantic-release.yml');
  assert.deepEqual(own.on.push.branches, ['main']);
});
test('relative documentation links and adoption pin examples resolve structurally', async () => {
  for (const path of ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'LICENSE.md',
    'docs/releases.md', 'docs/licensing.md', 'docs/developer-interface.md',
    '.github/SETTINGS.md']) {
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
