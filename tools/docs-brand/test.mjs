// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {test, describe} from 'node:test';
import {createHash} from 'node:crypto';
import {resolve, verify, upgrade, validate} from './lock.mjs';
import {mkdtempSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {main} from './lock.mjs';
const bytes = Buffer.from('body { color: teal; }\n');
const newBytes = Buffer.from('body { color: aqua; }\n');
const newHash = createHash('sha256').update(newBytes).digest('hex');
const hash = createHash('sha256').update(bytes).digest('hex');
const commits = {'v1.0.0': 'a'.repeat(40), 'v1.1.0': 'b'.repeat(40)};
export function get(url) {
  if (url.includes('/releases/tags/')) return JSON.stringify({tag_name:url.split('/').at(-1),draft:false,prerelease:false});
  if (url.includes('/commits/')) return JSON.stringify({sha:commits[url.split('/').at(-1)]});
  return url.includes('b'.repeat(40)) ? newBytes : bytes;
}
export const previous = {repository:'Living-Proof-Labs/collaboration-guidelines',version:'v1.0.0',commit:commits['v1.0.0'],path:'brand/docs/brand.css',sha256:hash};
describe('Docs brand provenance', () => {
test('lock regeneration verifies old provenance and resolves all new fields', () => {
  assert.deepEqual(upgrade(previous,{...previous,version:'v1.1.0'},get), {...previous,version:'v1.1.0',commit:commits['v1.1.0'],sha256:newHash});
  assert.deepEqual(verify(previous,get),previous);
});
for (const key of ['repository','path','commit','sha256']) test(`reject modified ${key} before regeneration`, () => {
  assert.throws(() => upgrade(previous,{...previous,[key]:'bad'},get));
});
for (const version of ['main','v1','v1.0','v1.1.0-rc.1','v01.0.0','v1.0.0;echo bad']) test(`reject invalid version ${version}`, () => {
  assert.throws(() => validate({...previous,version}));
});
test('reject moved old tag, corrupt checksum and unexpected fields', () => {
  assert.throws(() => upgrade({...previous,commit:'c'.repeat(40)}, {...previous,commit:'c'.repeat(40),version:'v1.1.0'},get), /provenance/);
  assert.throws(() => verify({...previous,sha256:'0'.repeat(64)},get), /provenance/);
  assert.throws(() => validate({...previous,extra:true}));
});
for (const change of [{draft:true},{prerelease:true},{tag_name:'v9.0.0'}]) test(`reject release metadata ${JSON.stringify(change)}`, () => {
  assert.throws(() => resolve('v1.1.0', url => url.includes('/releases/') ? JSON.stringify({tag_name:'v1.1.0',draft:false,prerelease:false,...change}) : get(url)), /published stable/);
});
test('reject network failure, empty CSS and tag movement during download', () => {
  assert.throws(() => resolve('v1.1.0',()=>{throw Error('HTTP 404');}), /404/);
  assert.throws(() => resolve('v1.1.0',url=>url.includes('raw.githubusercontent')?Buffer.alloc(0):get(url)), /empty/);
  let reads=0;
  assert.throws(() => resolve('v1.1.0',url=>url.includes('/commits/') && ++reads===2 ? JSON.stringify({sha:'c'.repeat(40)}):get(url)), /moved/);
});

test('command reads committed baseline and writes only a complete lock; failed checks preserve proposal', () => {
  const root = mkdtempSync(join(tmpdir(),'docs-brand-'));
  const cwd = process.cwd();
  const git = args => execFileSync('git',args,{cwd:root,stdio:'pipe'});
  git(['init']);
  const file = join(root,'docs-brand.lock.json');
  writeFileSync(file,JSON.stringify(previous));
  git(['add','docs-brand.lock.json']);
  git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','baseline']);
  try {
    process.chdir(root);
    const proposed = JSON.stringify({...previous,version:'v1.1.0'});
    writeFileSync(file,proposed);
    assert.throws(()=>main(['--update'],()=>{throw Error('HTTP 403');}),/403/);
    assert.equal(readFileSync(file,'utf8'),proposed);
    main(['--update'],get);
    const actual = JSON.parse(readFileSync(file,'utf8'));
    assert.equal(actual.version,'v1.1.0');
    assert.equal(actual.commit,'b'.repeat(40));
    main(['--check'],get);
    assert.deepEqual(readdirSync(root).sort(),['.git','docs-brand.lock.json']);
    // Once committed, a repeat run is a verified no-op.
    git(['add','docs-brand.lock.json']);
    git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','upgrade']);
    const complete = readFileSync(file,'utf8');
    main(['--update'],get);
    assert.equal(readFileSync(file,'utf8'),complete);
    assert.throws(()=>main([]),/Usage/);
  } finally { process.chdir(cwd); }
});

});
