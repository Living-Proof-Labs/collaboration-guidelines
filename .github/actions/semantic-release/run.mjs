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

function previewBuildVersions(base, prNumber, runNumber, runId, runAttempt) {
  if (!stable(base) || ![runNumber, runId, runAttempt].every(identifier) ||
      (prNumber !== null && !identifier(prNumber))) {
    throw new Error('Preview build versions require a stable base and canonical PR number, workflow run number, run ID and attempt');
  }
  const lead = prNumber === null ? 'main' : `pr.${prNumber}`;
  const suffix = `${lead}.${runNumber}.${runAttempt}`;
  const version = `${base}-${suffix}`;
  if (semver.valid(version) !== version) throw new Error('Invalid preview SemVer build version');
  // The fixed-width tails preserve numeric ordering within a workflow.
  return {
    'semver-version': version,
    'pep440-version': `${base}.dev${runNumber}${runId.padStart(20, '0')}${runAttempt.padStart(20, '0')}`,
    'debian-version': `${base}~${suffix}`,
  };
}

export function candidateBuildVersions(base, prNumber, runNumber, runId, runAttempt) {
  if (!identifier(prNumber)) throw new Error('Invalid PR number for preview build version');
  return previewBuildVersions(base, prNumber, runNumber, runId, runAttempt);
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

// This read-only gate applies only to an explicit main delivery retry.
export async function readPublishedReplay(repo, tag, commit, get = path =>
  JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', path], { encoding: 'utf8' }))) {
  const validSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.exec(value)?.[0] === value;
  const repoPattern = /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/;
  if (typeof repo !== 'string' || repoPattern.exec(repo)?.[0] !== repo ||
      ['.', '..'].includes(repo.split('/')[1]) || typeof tag !== 'string' || !tag.startsWith('v') || !stable(tag.slice(1)) || !validSha(commit)) {
    throw new Error('Delivery retry requires a canonical repository, stable tag, and exact commit');
  }
  const path = `repos/${repo}`;
  const current = await get(`${path}/git/ref/heads/main`);
  if (current?.ref !== 'refs/heads/main' || current.object?.type !== 'commit' || current.object.sha !== commit) {
    throw new Error('Delivery retry does not name current main');
  }
  const ref = await get(`${path}/git/ref/tags/${tag}`);
  if (ref?.ref !== `refs/tags/${tag}`) throw new Error('Delivery retry did not resolve the fully qualified tag');
  let object = ref.object;
  for (let depth = 0; object?.type === 'tag' && validSha(object.sha) && depth < 8; depth++) {
    const annotated = await get(`${path}/git/tags/${object.sha}`);
    if (annotated?.sha !== object.sha) throw new Error('Delivery retry returned a different tag object');
    object = annotated.object;
  }
  if (object?.type !== 'commit' || object.sha !== commit) {
    throw new Error('Delivery retry tag does not resolve to the exact commit');
  }
  const release = await get(`${path}/releases/tags/${tag}`);
  if (release?.tag_name !== tag || release.draft !== false || release.prerelease !== false ||
      typeof release.published_at !== 'string' || !release.published_at.trim()) {
    throw new Error('Delivery retry requires an already published stable release');
  }
  return tag.slice(1);
}

export async function run({ getReplay = readPublishedReplay, releaseEngine } = {}) {
  if (!['true', 'false'].includes(process.env.RELEASE_DRY_RUN)) {
    throw new Error('dry-run must be true or false');
  }
  const draftValue = process.env.RELEASE_DRAFT ?? 'false';
  if (!['true', 'false'].includes(draftValue)) throw new Error('draft-release must be true or false');
  const candidateValue = process.env.RELEASE_CANDIDATE ?? 'false';
  if (!['true', 'false'].includes(candidateValue)) throw new Error('candidate must be true or false');
  const planOnlyValue = process.env.RELEASE_PLAN_ONLY ?? 'false';
  if (!['true', 'false'].includes(planOnlyValue)) throw new Error('plan-only must be true or false');

  const candidate = candidateValue === 'true';
  const readOnly = candidate || planOnlyValue === 'true';
  const draftRelease = readOnly ? false : draftValue === 'true';
  const dryRun = readOnly || process.env.RELEASE_DRY_RUN === 'true';
  if (!candidate && process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Release must run from main');
  }

  const cwd = process.env.GITHUB_WORKSPACE;
  const expected = candidate ? process.env.RELEASE_EXPECTED_COMMIT : process.env.GITHUB_SHA;
  const replayTag = process.env.RELEASE_REPLAY_TAG ?? '';
  if (readOnly && (draftValue === 'true' || process.env.GITHUB_TOKEN)) {
    throw new Error('Read-only version resolution must not receive a release token or request a draft');
  }
  const isDispatch = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if ((replayTag && (!readOnly || candidate || !isDispatch)) || (readOnly && isDispatch && !replayTag)) {
    throw new Error('An explicit main delivery retry requires a stable release tag');
  }
  if (readOnly && !candidate && !isDispatch && process.env.GITHUB_EVENT_NAME !== 'push') {
    throw new Error('Main version resolution requires a main push or an explicit delivery retry');
  }
  let plan;
  if (replayTag) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    if (commit !== expected) throw new Error('Delivery retry checkout does not match the exact triggering commit');
    plan = { commit };
  } else {
    plan = await planVersion(cwd, expected, {
      candidate, expectedBase: candidate ? process.env.RELEASE_EXPECTED_BASE : undefined,
      includeBuildBase: readOnly,
    });
  }
  const head = plan.commit;
  if (readOnly) {
    const { GITHUB_RUN_NUMBER: number, GITHUB_RUN_ID: id, GITHUB_RUN_ATTEMPT: attempt } = process.env;
    if (![number, id, attempt].every(identifier)) throw new Error('Invalid caller workflow run identity');
    let formats;
    if (replayTag) {
      if (process.env.GITHUB_SERVER_URL !== 'https://github.com') throw new Error('Delivery retry requires GitHub.com');
      const version = await getReplay(process.env.GITHUB_REPOSITORY, replayTag, head);
      if (!stable(version) || replayTag !== `v${version}`) throw new Error('Delivery retry version does not match its tag');
      formats = mainBuildVersions(version);
    } else if (candidate) {
      formats = candidateBuildVersions(plan.buildBase, process.env.RELEASE_PR_NUMBER, number, id, attempt);
    } else {
      formats = plan.version ? mainBuildVersions(plan.version) : previewBuildVersions(plan.buildBase, null, number, id, attempt);
    }
    const forecast = !replayTag && plan.version ? { nextRelease: plan } : false;
    const values = { ...outputs(forecast, true, false, head), ...formats, 'run-id': id, 'run-attempt': attempt };
    await emit(values);
    return;
  }

  const semanticRelease = releaseEngine ?? (await import('semantic-release')).default;
  const release = configuration(draftRelease);
  release.plugins.push([fileURLToPath(new URL('./verify-plan.mjs', import.meta.url)), plan]);
  const result = await semanticRelease({
    ...release, extends: [], dryRun,
    repositoryUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`,
  }, { cwd });
  if (result?.nextRelease && !dryRun) {
    verifyTagMatchesCommit(result.nextRelease.gitTag, head, { cwd, fetchTag: true });
  }
  await emit(outputs(result, dryRun, draftRelease, head));
}

async function emit(values) {
  await appendFile(process.env.GITHUB_OUTPUT,
    Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
