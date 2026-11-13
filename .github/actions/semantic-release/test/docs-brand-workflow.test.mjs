// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const workflow=YAML.parse(readFileSync(join(root,'.github/workflows/docs-brand-renovate.yml'),'utf8'));
const action=YAML.parse(readFileSync(join(root,'.github/actions/docs-brand-renovate/action.yml'),'utf8'));
test('brand writer is callable only and denies PR events and nondefault refs before credentials',()=>{
  assert.deepEqual(Object.keys(workflow.on),['workflow_call']);
  const job=workflow.jobs.update;
  assert.equal(job.if,"(github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && github.ref == format('refs/heads/{0}', github.event.repository.default_branch) && github.repository_owner == 'Living-Proof-Labs'");
  assert.deepEqual(workflow.permissions,{contents:'read'});
  assert.equal(workflow.concurrency['cancel-in-progress'],false);
  assert.equal(job['timeout-minutes'],20);
  assert.equal(job.steps.length,1);
  assert.equal(job.steps[0].uses,'$/.github/actions/docs-brand-renovate');
  const steps=action.runs.steps;
  assert.equal(action.runs.using,'composite');
  const token=steps.find(s=>s.id==='token');
  assert.equal(steps.indexOf(token),1);
  assert.deepEqual(Object.keys(token.with).sort(),['client-id','permission-checks','permission-contents','permission-pull-requests','permission-statuses','private-key']);
  assert.equal(token.with['permission-contents'],'write');
  assert.equal(token.with['permission-pull-requests'],'write');
  assert.equal(steps.at(-1).env.RENOVATE_TOKEN,'${{ steps.token.outputs.token }}');
  assert.equal(steps.at(-1).env.DOCS_BRAND_REPOSITORY,'${{ github.repository }}');
  assert.equal(steps.at(-1).env.ACTION_PATH,'${{ github.action_path }}');
});
test('executable invocation guard rejects PRs, workflow_run, foreign repos and branch dispatches',()=>{
  const script=action.runs.steps[0].run;
  const base={...process.env,CALLER_EVENT:'schedule',CALLER_REF:'refs/heads/main',DEFAULT_BRANCH:'main',CALLER_REPOSITORY:'Living-Proof-Labs/fixture'};
  for(const override of [
    {CALLER_EVENT:'pull_request'},{CALLER_EVENT:'pull_request_target'},
    {CALLER_EVENT:'workflow_run'},{CALLER_EVENT:'push'},
    {CALLER_EVENT:'workflow_dispatch',CALLER_REF:'refs/heads/feature'},
    {CALLER_REPOSITORY:'foreign/fixture'},{DEFAULT_BRANCH:''},
  ]) assert.throws(()=>execFileSync('bash',['-e','-c',script],{env:{...base,...override},stdio:'pipe'}));
  for(const CALLER_EVENT of ['schedule','workflow_dispatch']) {
    execFileSync('bash',['-e','-c',script],{env:{...base,CALLER_EVENT},stdio:'pipe'});
  }
});
test('runner passes only installation token and single target with read-only policy and helper mounts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'brand-docker-'));
  writeFileSync(join(dir,'docker'),'#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\n',{mode:0o755});
  const env={...process.env,PATH:`${dir}:${process.env.PATH}`,RENOVATE_TOKEN:'fixture-not-a-credential',DOCS_BRAND_REPOSITORY:'Living-Proof-Labs/fixture'};
  const args=JSON.parse(execFileSync('bash',[join(root,'tools/docs-brand/run.sh')],{env,encoding:'utf8'}));
  assert.equal(args.includes(env.RENOVATE_TOKEN),false);
  assert.ok(args.includes('RENOVATE_TOKEN'));
  assert.ok(args.includes('DOCS_BRAND_REPOSITORY'));
  assert.equal(args.some(a=>a.includes('docker.sock')),false);
  assert.equal(args.some(a=>a.includes('PRIVATE_KEY')),false);
  const mounts=args.filter((a,i)=>args[i-1]==='-v');
  assert.equal(mounts.length,2);
  assert.ok(mounts.every(m=>m.endsWith(':ro')));
  assert.ok(mounts.some(m=>m.endsWith(':/opt/docs-brand/lock.mjs:ro')));
  assert.equal(args.at(-1),readFileSync(join(root,'tools/renovate/image.txt'),'utf8').trim());
  assert.match(args.at(-1),/^renovate\/renovate:[0-9]+\.[0-9]+\.[0-9]+@sha256:[a-f0-9]{64}$/);
  for(const override of [{RENOVATE_TOKEN:''},{DOCS_BRAND_REPOSITORY:'other/repo'},{DOCS_BRAND_REPOSITORY:'Living-Proof-Labs/repo;echo bad'}]){
    assert.throws(()=>execFileSync('bash',[join(root,'tools/docs-brand/run.sh')],{env:{...env,...override},stdio:'pipe'}));
  }
});
