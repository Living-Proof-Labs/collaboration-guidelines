// SPDX-License-Identifier: Apache-2.0
// Trusted global configuration. Never load this from a consumer PR checkout.
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const repository = process.env.DOCS_BRAND_REPOSITORY;
if (!/^Living-Proof-Labs\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
  throw new Error('DOCS_BRAND_REPOSITORY must name one Living-Proof-Labs repository');
}
const policy = JSON.parse(readFileSync(join(__dirname,'../../renovate-preset.json'),'utf8'));
const optIn = JSON.parse(readFileSync(join(__dirname,'../../renovate-docs-brand.json'),'utf8'));
module.exports = {
  platform: 'github',
  repositories: [repository],
  autodiscover: false,
  onboarding: false,
  requireConfig: 'ignored',
  inheritConfig: false,
  enabledManagers: ['custom.regex'],
  customManagers: policy.customManagers.filter(manager => manager.depTypeTemplate === 'docs-brand'),
  packageRules: [
    {matchDepTypes: ['docs-brand'], allowedVersions: '/^v[0-9]+\\.[0-9]+\\.[0-9]+$/', separateMajorMinor: false},
    ...optIn.packageRules,
  ],
  branchPrefix: 'renovate-docs-brand/',
  branchConcurrentLimit: 1,
  prConcurrentLimit: 1,
  prHourlyLimit: 1,
  dependencyDashboard: false,
  vulnerabilityAlerts: {enabled: false},
  schedule: ['at any time'],
  ignoreUnstable: true,
  automerge: false,
  platformAutomerge: false,
  allowScripts: false,
  allowPlugins: false,
  exposeAllEnv: false,
  allowedEnv: [],
  allowShellExecutorForPostUpgradeCommands: false,
  allowedCommands: ['^node /opt/docs-brand/lock\\.mjs --update$'],
  binarySource: 'global',
  gitNoVerify: ['commit', 'push'],
  cloneSubmodules: false,
  baseDir: '/tmp/renovate',
  cacheDir: '/tmp/renovate-cache',
  prBodyNotes: ['Review the complete brand lock and require provenance and rendered-manual checks before merging.'],
};
