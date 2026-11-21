// SPDX-License-Identifier: Apache-2.0
import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';
import config from './release.config.mjs';
import { planVersion } from './plan.mjs';

// Adapt the official engine result to the GitHub Actions output contract.
export function outputs(result, dryRun, draftRelease = false, commit = '') {
  const next = result?.nextRelease;
  return {
    published: String(Boolean(next) && !dryRun && !draftRelease),
    'draft-created': String(Boolean(next) && !dryRun && draftRelease),
    version: next?.version ?? '',
    'git-tag': next?.gitTag ?? '',
    'release-url': dryRun ? '' : (result?.releases?.find(r => r.url)?.url ?? ''),
    commit,
  };
}

const stable = value => typeof value === 'string' &&
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value) && semver.valid(value) === value;
const identifier = value => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.exec(value)?.[0] === value;

export function candidateBuildVersions(base, prNumber, runNumber, runId, runAttempt) {
  if (!stable(base) || ![prNumber, runNumber, runId, runAttempt].every(identifier)) {
    throw new Error('Candidate build versions require a stable base and canonical PR number, workflow run number, run ID and attempt');
  }
  const suffix = `pr.${prNumber}.${runNumber}.${runAttempt}`;
  const version = `${base}-${suffix}`;
  if (semver.valid(version) !== version) throw new Error('Invalid candidate SemVer build version');
  // A run ID is unique in its repository, but only a run number is ordered
  // within a workflow. Fixed widths keep the run ID and attempt distinct
  // without allowing either to outrank a later workflow run.
  return {
    'semver-version': version,
    'pep440-version': `${base}.dev${runNumber}${runId.padStart(20, '0')}${runAttempt.padStart(20, '0')}`,
    'debian-version': `${base}~${suffix}`,
  };
}

const mainBuildVersions = version => ({
  'semver-version': version, 'pep440-version': version, 'debian-version': version,
});

export function configuration(draftRelease = false) {
  return { ...config, plugins: config.plugins.map(([name, options], index) =>
    [name, index === 2 ? { ...options, draftRelease } : options]) };
}

export function verifyTagMatchesCommit(gitTag, expectedCommit, { cwd, fetchTag = true } = {}) {
  if (fetchTag) {
    execFileSync('git', ['fetch', 'origin', `refs/tags/${gitTag}:refs/tags/${gitTag}`, '--force'], {
      cwd,
      encoding: 'utf8',
    });
  }
  const taggedCommit = execFileSync('git', ['rev-parse', '--verify', `refs/tags/${gitTag}^{commit}`], {
    cwd,
    encoding: 'utf8',
  }).trim();
  if (taggedCommit !== expectedCommit) {
    throw new Error(`Tag ${gitTag} resolves to ${taggedCommit}, expected ${expectedCommit}`);
  }
}

export function verifiedMainBuildVersion(next, expectedCommit, options) {
  if (!stable(next.version) || next.gitTag !== `v${next.version}`) {
    throw new Error('Release tag and plain version disagree');
  }
  verifyTagMatchesCommit(next.gitTag, expectedCommit, options);
  return mainBuildVersions(next.version);
}

export async function run() {
  if (!['true', 'false'].includes(process.env.RELEASE_DRY_RUN)) {
    throw new Error('dry-run must be true or false');
  }
  const draftValue = process.env.RELEASE_DRAFT ?? 'false';
  if (!['true', 'false'].includes(draftValue)) throw new Error('draft-release must be true or false');
  const candidateValue = process.env.RELEASE_CANDIDATE ?? 'false';
  if (!['true', 'false'].includes(candidateValue)) throw new Error('candidate must be true or false');

  const candidate = candidateValue === 'true';
  const draftRelease = candidate ? false : draftValue === 'true';
  const dryRun = candidate ? true : process.env.RELEASE_DRY_RUN === 'true';

  if (!candidate && process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Release must run from main');
  }

  const cwd = process.env.GITHUB_WORKSPACE;
  const expected = candidate ? process.env.RELEASE_EXPECTED_COMMIT : process.env.GITHUB_SHA;
  if (candidate && (draftValue === 'true' || process.env.GITHUB_TOKEN)) {
    throw new Error('Candidate must not receive a release token or request a draft');
  }
  const plan = await planVersion(cwd, expected, {
    candidate, expectedBase: candidate ? process.env.RELEASE_EXPECTED_BASE : undefined,
    includeBuildBase: candidate,
  });
  const head = plan.commit;
  let result;
  let buildVersions = mainBuildVersions('');
  if (candidate) {
    // The planner only reads Git history and calls the locked commit analyzer.
    // Do not enter the engine's remote authorization/publish lifecycle here.
    buildVersions = candidateBuildVersions(plan.buildBase, process.env.RELEASE_PR_NUMBER,
      process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT);
    result = plan.version ? { nextRelease: plan } : false;
  } else {
    const { default: semanticRelease } = await import('semantic-release');
    const release = configuration(draftRelease);
    release.plugins.push([fileURLToPath(new URL('./verify-plan.mjs', import.meta.url)), plan]);
    result = await semanticRelease({
      ...release, extends: [], dryRun,
      repositoryUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`,
    }, { cwd });
    if (result?.nextRelease && !dryRun) {
      buildVersions = verifiedMainBuildVersion(result.nextRelease, head, { cwd, fetchTag: true });
    }
  }

  const values = { ...outputs(result, dryRun, draftRelease, head),
    'build-version': buildVersions['semver-version'], ...buildVersions };
  await appendFile(process.env.GITHUB_OUTPUT,
    Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
