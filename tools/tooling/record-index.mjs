// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [image, tag, revision] = process.argv.slice(2);
const index = JSON.parse(readFileSync('artifacts/tooling-index.json', 'utf8'));
assert.match(index.digest, /^sha256:[0-9a-f]{64}$/);
const platforms = index.manifests.map(m => `${m.platform.os}/${m.platform.architecture}`).sort();
assert.deepEqual(platforms, ['linux/amd64', 'linux/arm64']);
const children = {};
for (const manifest of index.manifests) {
  const arch = manifest.platform.architecture;
  const child = JSON.parse(readFileSync(`artifacts/tooling-${arch}.json`, 'utf8'));
  assert.match(child.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(manifest.digest, child.digest, `Index must reference published ${arch} image`);
  children[arch] = child.digest;
}
writeFileSync('artifacts/tooling-image.json', JSON.stringify({
  image, tag, revision, digest: index.digest, reference: `${image}:${tag}@${index.digest}`, platforms, children,
}, null, 2) + '\n');
