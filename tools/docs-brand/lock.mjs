// SPDX-License-Identifier: Apache-2.0
// Install this reviewed file outside consumer checkouts before allowing Renovate to run it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const repository = 'Living-Proof-Labs/collaboration-guidelines';
const path = 'brand/docs/brand.css';
const file = 'docs-brand.lock.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function validate(lock) {
  if (Object.keys(lock).sort().join() !== 'commit,path,repository,sha256,version' ||
      lock.repository !== repository || lock.path !== path ||
      !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(lock.version) ||
      !/^[a-f0-9]{40}$/.test(lock.commit) || !/^[a-f0-9]{64}$/.test(lock.sha256)) {
    throw new Error('Expected the five-field docs brand lock with a full release tag, commit and sha256');
  }
}
export function download(url) {
  // Public source only: no consumer token, shell interpolation, or redirects.
  const response = execFileSync('curl', ['--disable', '--fail', '--silent', '--show-error', '--proto', '=https',
    '--max-time', '60', '--max-filesize', '1048576', '--write-out', '\n%{http_code}', url], {maxBuffer: 1048580});
  if (response.subarray(-4).toString() !== '\n200') throw new Error('Expected HTTP 200 without redirects');
  return response.subarray(0, -4);
}
export function resolve(version, get = download) {
  const api = `https://api.github.com/repos/${repository}`;
  const release = JSON.parse(get(`${api}/releases/tags/${version}`));
  if (release.tag_name !== version || release.draft !== false || release.prerelease !== false) {
    throw new Error('Expected a published stable release matching the requested tag');
  }
  const commit = JSON.parse(get(`${api}/commits/${version}`)).sha;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Release did not resolve to a full commit');
  const bytes = get(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`);
  if (!bytes.length) throw new Error('Brand CSS is empty');
  // Detect a tag changing during the download as well as between runs.
  if (JSON.parse(get(`${api}/commits/${version}`)).sha !== commit) throw new Error('Release tag moved during resolution');
  return {repository, version, commit, path, sha256: sha256(bytes)};
}
export function verify(lock, get = download) {
  validate(lock);
  const actual = resolve(lock.version, get);
  if (actual.commit !== lock.commit || actual.sha256 !== lock.sha256) {
    throw new Error('Brand provenance mismatch: release commit or CSS sha256 differs from the lock');
  }
  return actual;
}
export function upgrade(previous, proposed, get = download) {
  validate(previous);
  validate(proposed);
  for (const key of ['repository', 'path', 'commit', 'sha256']) {
    if (previous[key] !== proposed[key]) throw new Error(`Renovate may change only version before regeneration: ${key}`);
  }
  verify(previous, get);
  return resolve(proposed.version, get);
}
export function main(args, get = download) {
  if (args.length !== 1 || !['--check', '--update'].includes(args[0])) {
    throw new Error('Usage: node /opt/docs-brand/lock.mjs --check|--update (from the consumer root)');
  }
  const proposed = JSON.parse(readFileSync(file, 'utf8'));
  if (args[0] === '--check') { verify(proposed, get); return; }
  const previous = JSON.parse(execFileSync('git', ['show', `HEAD:${file}`], {encoding: 'utf8'}));
  const next = upgrade(previous, proposed, get);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', {flag: 'wx'});
    renameSync(temporary, file);
  } finally {
    try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
