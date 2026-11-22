// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from 'node:child_process';
import { generateNotes } from '@semantic-release/release-notes-generator';
import semver from 'semver';
import config from './release.config.mjs';

// The writer already tried once. These are the later attempts.
export const NOTES_PUSH_BACKOFF_MS = [1000, 2000, 4000];
const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const logger = { log() {}, error() {}, success() {} };

export function authenticatedPushUrl(repositoryUrl, env) {
  const token = env.GITHUB_TOKEN;
  if (env.GITHUB_ACTION && token && repositoryUrl.startsWith('https://') && !repositoryUrl.includes('@')) {
    return `https://x-access-token:${token}@${repositoryUrl.slice('https://'.length)}`;
  }
  return repositoryUrl;
}

function collectErrorText(error) {
  const parts = [];
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    for (const value of [current.message, current.stderr, current.shortMessage, current.command]) {
      if (value != null) parts.push(String(value));
    }
    if (current.cause) pending.push(current.cause);
    if (Array.isArray(current.errors)) pending.push(...current.errors);
  }
  return parts.join('\n');
}

export function notesPushFailure(error) {
  const text = collectErrorText(error);
  const match = text.match(/refs\/notes\/semantic-release-(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))/);
  if (!match || !/git push|\[remote rejected\]|failed to push/.test(text)) return null;
  return { tag: match[1], ref: `refs/notes/semantic-release-${match[1]}` };
}

export function tagAlreadyExists(error) {
  const match = collectErrorText(error)
    .match(/tag '?(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))'? already exists/);
  return match?.[1] ?? null;
}

// Ignore tiny values so a short placeholder cannot punch holes in unrelated text.
const minimumSecretLength = 8;
const textFields = [
  'message', 'stack', 'stderr', 'stdout', 'command', 'shortMessage', 'cmd',
  'escapedCommand', 'originalMessage', 'description',
];

function isCredentialQueryName(name) {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name.replace(/\+/g, ' '));
  } catch {
    // Keep the raw name when it is not valid percent-encoding.
  }
  const normalized = decoded.toLowerCase().replace(/-/g, '_');
  if (normalized === 'token_type') return false;
  if (normalized.includes('token')) return true;
  return /(?:^|_)(?:password|passwd|secret|api_key|apikey)$/.test(normalized) ||
    ['auth', 'authorization', 'password', 'passwd', 'secret', 'api_key', 'apikey'].includes(normalized);
}

function credentialSecrets(env) {
  const secrets = [];
  for (const value of [env?.GITHUB_TOKEN, env?.GH_TOKEN]) {
    if (typeof value !== 'string' || value.length < minimumSecretLength || secrets.includes(value)) continue;
    secrets.push(value);
    const encoded = encodeURIComponent(value);
    if (encoded !== value && !secrets.includes(encoded)) secrets.push(encoded);
  }
  return secrets.sort((left, right) => right.length - left.length);
}

function asText(value) {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('utf8');
  }
  return null;
}

// Strip URL userinfo, token query values, and configured tokens before anything is printed.
export function redactText(text, env = {}) {
  let cleaned = String(text ?? '');
  cleaned = cleaned.replace(/(https?:\/\/)[^/?#\s@]+@/gi, '$1***@');
  cleaned = cleaned.replace(/\bx-access-token:[^\s@]+/gi, 'x-access-token:***');
  cleaned = cleaned.replace(/([?&])([^&#=\s]+)=([^&#\s]*)/g, (match, separator, name, value) => {
    if (!value || !isCredentialQueryName(name)) return match;
    return `${separator}${name}=***`;
  });
  for (const secret of credentialSecrets(env)) cleaned = cleaned.split(secret).join('***');
  return cleaned;
}

export function redactError(error, env = {}) {
  const seen = new WeakSet();
  const visit = value => {
    const text = asText(value);
    if (text !== null) return redactText(text, env);
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) value[index] = visit(value[index]);
      return value;
    }
    const assign = (key, next) => {
      try { value[key] = next; } catch { /* read-only */ }
    };
    for (const key of textFields) {
      if (value[key] == null) continue;
      assign(key, visit(value[key]));
    }
    if (value.output != null) assign('output', visit(value.output));
    if (value.cause) assign('cause', visit(value.cause));
    if (Array.isArray(value.errors)) assign('errors', value.errors.map(item => visit(item)));
    for (const key of Object.keys(value)) {
      const textValue = asText(value[key]);
      if (textValue === null) continue;
      assign(key, redactText(textValue, env));
    }
    return value;
  };
  return visit(error);
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: 'pipe', env: process.env, timeout: 60_000,
    });
  } catch (error) {
    throw redactError(error, process.env);
  }
}

export function peelTag(cwd, tag) {
  try {
    return git(cwd, ['rev-parse', '--verify', `${tag}^{commit}`]).trim();
  } catch {
    return null;
  }
}

export function remoteTagCommit(cwd, repositoryUrl, tag) {
  const stdout = git(cwd, ['ls-remote', '--tags', '--', repositoryUrl, `refs/tags/${tag}`]);
  let direct = null;
  let peeled = null;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const [sha, ref] = line.split('\t');
    if (ref === `refs/tags/${tag}^{}`) peeled = sha;
    else if (ref === `refs/tags/${tag}`) direct = sha;
  }
  return peeled || direct;
}

function versionOf(tag) {
  const match = stableTag.exec(tag);
  if (!match) return null;
  const version = `${match[1]}.${match[2]}.${match[3]}`;
  return semver.valid(version) === version ? version : null;
}

function highestTagAt(cwd, head) {
  const tags = git(cwd, [
    'for-each-ref', '--format=%(refname:short)%00%(objecttype)%00%(objectname)%00%(*objectname)', 'refs/tags',
  ]).split('\n').flatMap(line => {
    if (!line) return [];
    const [tag, type, objectName, peeled] = line.split('\0');
    const version = versionOf(tag);
    const commit = type === 'tag' ? peeled : objectName;
    return version && commit === head ? [{ tag, version }] : [];
  }).sort((left, right) => semver.rcompare(left.version, right.version));
  return tags[0]?.tag ?? null;
}

function previousStableTag(cwd, head, gitTag) {
  const tags = git(cwd, ['tag', '--merged', head]).split('\n').flatMap(tag => {
    const version = versionOf(tag);
    return version && tag !== gitTag ? [{ tag, version }] : [];
  }).sort((left, right) => semver.rcompare(left.version, right.version));
  return tags[0] ?? null;
}

function commitsSince(cwd, previousTag, head) {
  const range = previousTag ? `${previousTag}..${head}` : head;
  const entries = git(cwd, ['log', '-z', '--format=%H%x00%B', range]).split('\0');
  if (entries.at(-1) === '') entries.pop();
  const commits = [];
  for (let index = 0; index < entries.length; index += 2) {
    const message = entries[index + 1]?.trim();
    if (message) commits.push({ hash: entries[index], message });
  }
  return commits;
}

async function notesForTag(cwd, gitTag, head, repositoryUrl) {
  const previous = previousStableTag(cwd, head, gitTag);
  const notes = await generateNotes(config.plugins[1][1], {
    cwd, logger, options: { repositoryUrl },
    commits: commitsSince(cwd, previous?.tag, head),
    lastRelease: previous ? {
      version: previous.version, gitTag: previous.tag, gitHead: peelTag(cwd, previous.tag),
    } : {},
    nextRelease: { version: gitTag.slice(1), gitTag, gitHead: head, name: gitTag },
  });
  if (typeof notes !== 'string' || !notes.trim()) throw new Error(`Release notes for ${gitTag} were empty`);
  return notes;
}

function releaseResult(tag, url) {
  return { nextRelease: { version: tag.slice(1), gitTag: tag }, releases: [{ url }] };
}

function repositoryName() {
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('Recovery requires GITHUB_REPOSITORY as owner/name');
  }
  return repo;
}

function viewRelease(tag, gh, cwd) {
  try {
    const data = JSON.parse(gh(
      ['release', 'view', tag, '--repo', repositoryName(), '--json', 'tagName,isDraft,url'],
      { cwd },
    ));
    if (data?.tagName !== tag || typeof data.url !== 'string' || !data.url) {
      throw new Error(`Release view for ${tag} returned an unexpected payload`);
    }
    return data;
  } catch (error) {
    const text = `${error.stderr ?? ''}\n${error.message ?? ''}`;
    if (error.status === 1 && /release not found/i.test(text)) return null;
    throw error;
  }
}

function createRelease(tag, draft, notes, gh, cwd) {
  const args = [
    'release', 'create', tag, '--repo', repositoryName(), '--verify-tag', '--title', tag, '--notes-file', '-',
  ];
  if (draft) args.push('--draft');
  let stdout;
  try {
    stdout = gh(args, { input: notes, cwd });
  } catch (error) {
    const existing = viewRelease(tag, gh, cwd);
    if (existing) return { created: false };
    throw error;
  }
  const url = redactText(String(stdout).trim().split('\n').filter(Boolean).at(-1) ?? '', process.env);
  if (!/^https:\/\/\S+$/.test(url)) throw new Error(`Release creation for ${tag} did not return a URL`);
  return { created: true, result: releaseResult(tag, url) };
}

function refusal(tag, actual, head) {
  return `Tag ${tag} resolves to ${actual ?? 'missing'}, expected ${head}; refusing to create a release or move the tag`;
}

export function localTagRefusal(cwd, tag, head) {
  const local = peelTag(cwd, tag);
  return local && local !== head ? refusal(tag, local, head) : null;
}

async function publishIfMissing({ cwd, head, repositoryUrl, tag, draftRelease, gh }) {
  repositoryName();
  const remote = remoteTagCommit(cwd, authenticatedPushUrl(repositoryUrl, process.env), tag);
  if (!remote) return null;
  if (remote !== head) return { refused: refusal(tag, remote, head) };
  if (viewRelease(tag, gh, cwd)) return { noop: true };
  const notes = await notesForTag(cwd, tag, head, repositoryUrl);
  return createRelease(tag, draftRelease, notes, gh, cwd);
}

export async function recoverBareTag({ cwd, head, repositoryUrl, draftRelease, gh, sealedVersion = '' }) {
  const tag = sealedVersion ? `v${sealedVersion}` : highestTagAt(cwd, head);
  if (!tag || !versionOf(tag)) return null;
  const local = peelTag(cwd, tag);
  if (local !== head) return local ? { refused: refusal(tag, local, head) } : null;
  return publishIfMissing({ cwd, head, repositoryUrl, tag, draftRelease, gh });
}

export async function retryNotesPush({ cwd, url, ref, sleep, execFile }) {
  for (const delay of NOTES_PUSH_BACKOFF_MS) {
    await sleep(delay);
    try {
      execFile('git', ['push', '--', url, ref], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 60_000,
      });
      return true;
    } catch (error) {
      // The remote rejection is the condition this retry exists for.
      redactError(error, process.env);
    }
  }
  return false;
}

export async function recoverNotesFailure({
  error, cwd, head, repositoryUrl, draftRelease, sealedVersion, gh, sleep, execFile,
}) {
  const notesFailure = notesPushFailure(error);
  const existingTag = tagAlreadyExists(error);
  if (!notesFailure && !existingTag) return { unhandled: true };
  const tag = notesFailure?.tag ?? existingTag;
  if (sealedVersion && tag !== `v${sealedVersion}`) return { unhandled: true };
  const local = peelTag(cwd, tag);
  if (local !== head) return { refused: refusal(tag, local, head) };
  repositoryName();
  const url = authenticatedPushUrl(repositoryUrl, process.env);
  const remoteBefore = remoteTagCommit(cwd, url, tag);
  if (remoteBefore !== head) return { refused: refusal(tag, remoteBefore, head) };
  if (notesFailure) {
    const pushed = await retryNotesPush({ cwd, url, ref: notesFailure.ref, sleep, execFile });
    const remoteAfter = remoteTagCommit(cwd, url, tag);
    if (remoteAfter !== remoteBefore) {
      return { refused: `Tag ${tag} changed while retrying notes; refusing to create a release or move the tag` };
    }
    if (!pushed) {
      console.error(redactText(
        `Notes ref ${notesFailure.ref} was still rejected after ` +
        `${NOTES_PUSH_BACKOFF_MS.length} retries. Creating the GitHub Release from ${tag} without moving the tag.`,
        process.env,
      ));
    }
  }
  if (viewRelease(tag, gh, cwd)) return { noop: true };
  const notes = await notesForTag(cwd, tag, head, repositoryUrl);
  return createRelease(tag, draftRelease, notes, gh, cwd);
}

export function defaultGh(args, { input, cwd } = {}) {
  const env = { ...process.env, GH_PROMPT_DISABLED: '1' };
  if (!env.GH_TOKEN && env.GITHUB_TOKEN) env.GH_TOKEN = env.GITHUB_TOKEN;
  const workdir = cwd || env.GITHUB_WORKSPACE || process.cwd();
  try {
    return execFileSync('gh', args, {
      cwd: workdir, encoding: 'utf8', input, env, stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000,
    });
  } catch (error) {
    error.stderr = error.stderr?.toString?.() ?? '';
    throw redactError(error, env);
  }
}

export const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
