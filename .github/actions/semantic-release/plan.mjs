// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import semver from 'semver';
import config from './release.config.mjs';

const shaPattern = /^[0-9a-f]{40}$/;
const releaseTag = new RegExp('^' + RegExp.escape(config.tagFormat)
  .replace(RegExp.escape('${version}'), '(.+)') + '$');
// Match the locked semantic-release 25.0.9 analyzeCommits preprocessor.
const skipRelease = /\[skip\s+release]|\[release\s+skip]/i;
const logger = { log() {}, error() {} };

export async function planVersion(cwd, expected, { candidate = false, expectedBase } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const commit = git('rev-parse', 'HEAD').trim();
  if (!shaPattern.test(expected ?? '') || commit !== expected) {
    throw new Error('Checked-out HEAD must match the triggering commit');
  }
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'false') {
    throw new Error('Version planning requires complete Git history');
  }
  let baseline = commit;
  if (candidate) {
    if (!shaPattern.test(expectedBase ?? '')) {
      throw new Error('Version planning requires the exact PR event base commit');
    }
    try {
      git('merge-base', '--is-ancestor', expectedBase, 'refs/remotes/origin/main');
    } catch {
      throw new Error('PR event base is not reachable from canonical origin/main');
    }
    // Restrict eligible tags to the common history of the exact PR head and
    // the event's canonical base. A later main advance cannot change this range.
    baseline = git('merge-base', expectedBase, commit).trim();
  }
  const tags = git('tag', '--merged', baseline).split('\n').flatMap(tag => {
    const [, version] = tag.match(releaseTag) ?? [];
    // The locked engine accepts stable semantic versions with build metadata
    // and ignores prereleases on main. Refuse ambiguous legacy spellings that
    // it accepts via clean() but cannot consistently compare as raw versions.
    if (!version || !semver.clean(version)) return [];
    if (!semver.valid(version)) throw new Error(`Unsupported release baseline tag: ${tag}`);
    return semver.prerelease(version) ? [] : [{ tag, version }];
  }).sort((left, right) => semver.rcompare(left.version, right.version));
  const last = tags[0];
  const range = last ? `${last.tag}..${commit}` : commit;
  const entries = git('log', '-z', '--format=%H%x00%B', range).split('\0');
  if (entries.at(-1) === '') entries.pop();
  const commits = [];
  for (let i = 0; i < entries.length; i += 2) {
    // Both inputs to the shared analyzer use a trimmed full commit message.
    const message = entries[i + 1].trim();
    if (!skipRelease.test(message)) commits.push({ hash: entries[i], message });
  }
  const policyDirectory = fileURLToPath(new URL('.', import.meta.url));
  const type = await analyzeCommits(config.plugins[0][1], { commits, cwd: policyDirectory, logger });
  const version = type ? (last ? semver.inc(last.version, type) : '1.0.0') : '';
  if (type && !version) throw new Error('Cannot calculate a stable main release version');
  return { commit, version, gitTag: version ? config.tagFormat.replace('${version}', version) : '' };
}
