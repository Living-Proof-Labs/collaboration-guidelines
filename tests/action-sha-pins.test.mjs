// SPDX-License-Identifier: Apache-2.0
// Offline: third-party Action pins in the workflows this digest bump updates
// are a full 40-hex SHA plus a # vX.Y.Z tag comment.
// LIVINGPROOF_NETWORK=1: that SHA is the peeled commit of the tagged release,
// not the annotated tag object (the previous pin was the tag object 8861569).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

function root() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, ".github/workflows"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("could not find repository root");
    dir = parent;
  }
}

const ROOT = root();
const FILES = [
  ".github/workflows/generated-docs.yml",
  ".github/workflows/host.yml",
  ".github/workflows/renovate.yml",
];

const USES = /uses:\s*([^\s@]+)@([0-9a-f]{40})\s+#\s*(v\d+(?:\.\d+){0,2})/g;

function pins() {
  const found = [];
  for (const file of FILES) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const match of text.matchAll(USES)) {
      found.push({ file, ownerRepo: match[1], digest: match[2], tag: match[3] });
    }
  }
  return found;
}

test("updated workflows pin third-party Actions by full SHA and release tag", () => {
  const found = pins();
  assert.ok(
    found.some((p) => p.ownerRepo === "dorny/test-reporter"),
    "expected dorny/test-reporter among the updated workflows",
  );
  for (const pin of found) {
    assert.match(pin.digest, /^[0-9a-f]{40}$/);
    assert.match(pin.tag, /^v\d+(?:\.\d+){0,2}$/);
  }
});

const skipNetwork = process.env.LIVINGPROOF_NETWORK
  ? false
  : "set LIVINGPROOF_NETWORK=1";

test(
  "Action SHA pins are the peeled commit of the commented tag, not the tag object",
  { skip: skipNetwork },
  async () => {
    const found = pins();
    const token = process.env.GITHUB_TOKEN;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const cache = new Map();
    const peeled = async (ownerRepo, tag) => {
      const key = `${ownerRepo}@${tag}`;
      if (cache.has(key)) return cache.get(key);
      const url = `https://api.github.com/repos/${ownerRepo}/commits/${tag}`;
      const response = await fetch(url, { headers });
      assert.ok(response.ok, `${url} -> ${response.status}`);
      const body = await response.json();
      cache.set(key, body.sha);
      return body.sha;
    };
    for (const pin of found) {
      if (!pin.ownerRepo.includes("/")) continue;
      const sha = await peeled(pin.ownerRepo, pin.tag);
      assert.equal(
        pin.digest,
        sha,
        `${pin.file}: ${pin.ownerRepo}@${pin.digest} is not the peeled commit of ${pin.tag} (${sha})`,
      );
    }
  },
);
