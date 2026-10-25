// SPDX-License-Identifier: Apache-2.0
import semanticRelease from 'semantic-release';
import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import config from './release.config.mjs';

// Adapt the official engine result to the GitHub Actions output contract.
export function outputs(result, dryRun, draftRelease = false) {
  const next = result?.nextRelease;
  return {
    published: String(Boolean(next) && !dryRun && !draftRelease),
    'draft-created': String(Boolean(next) && !dryRun && draftRelease),
    version: next?.version ?? '',
    'git-tag': next?.gitTag ?? '',
    'release-url': dryRun ? '' : (result?.releases?.find(r => r.url)?.url ?? ''),
  };
}

export function configuration(draftRelease = false) {
  return { ...config, plugins: config.plugins.map(([name, options], index) =>
    [name, index === 2 ? { ...options, draftRelease } : options]) };
}

export async function run() {
  if (!['true', 'false'].includes(process.env.RELEASE_DRY_RUN)) {
    throw new Error('dry-run must be true or false');
  }
  if (process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Release must run from main');
  }
  const cwd = process.env.GITHUB_WORKSPACE;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  if (head !== process.env.GITHUB_SHA) {
    throw new Error('Checked-out HEAD must match the triggering commit');
  }
  const draftValue = process.env.RELEASE_DRAFT ?? 'false';
  if (!['true', 'false'].includes(draftValue)) throw new Error('draft-release must be true or false');
  const draftRelease = draftValue === 'true';
  const dryRun = process.env.RELEASE_DRY_RUN === 'true';
  const result = await semanticRelease({
    ...configuration(draftRelease), extends: [], dryRun,
    repositoryUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`,
  }, { cwd });
  const values = outputs(result, dryRun, draftRelease);
  await appendFile(process.env.GITHUB_OUTPUT,
    Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
