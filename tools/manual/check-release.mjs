// SPDX-License-Identifier: Apache-2.0
// Check the GitHub Release at the tag already bound to the exact source.
import { readFileSync } from 'node:fs';

const [tag] = process.argv.slice(2);
const release = JSON.parse(readFileSync(0, 'utf8'));
if (!(
  /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(tag) &&
  release?.tag_name === tag &&
  release.draft === false &&
  release.prerelease === false &&
  release.immutable === true &&
  typeof release.published_at === 'string' && release.published_at.length > 0
)) {
  throw new Error('Expected the exact immutable published stable guidelines release');
}
const assets = Array.isArray(release.assets)
  ? release.assets.filter(asset => asset?.state === 'uploaded').map(asset => asset.name)
  : [];
for (const name of ['tooling-index.json', 'tooling-image.json']) {
  if (assets.filter(asset => asset === name).length !== 1) {
    throw new Error('Expected both published tooling evidence assets');
  }
}
