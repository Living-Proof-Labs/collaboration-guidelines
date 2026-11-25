<!-- SPDX-License-Identifier: Apache-2.0 -->

# Licensing pattern for repositories

Living Proof Labs repositories use **Apache-2.0** only, with a single root
[`LICENSE`](../LICENSE) file containing the SPDX Apache-2.0 text. This covers
both code and documentation prose so license detectors and readers see one
unambiguous license across the repository.

## Apply Apache-2.0 consistently

1. Inventory original code, prose, data, and third-party material. Confirm that
   the project can license what it owns; preserve others' licenses and notices.
2. Include the full, unmodified SPDX Apache-2.0 text in a single root `LICENSE`
   file. Do not split code and documentation across a `LICENSE.md` index or
   multiple root license files.
3. Use `SPDX-License-Identifier: Apache-2.0` headers in source files and
   manifest license fields where the format supports them.
4. Preserve any applicable third-party `NOTICE` material or dependency licenses
   when redistributing; do not invent attribution or ownership.

## Reuse with the terms intact

Apache-2.0 permits commercial use and modification. When redistributing, provide
the license, retain relevant notices, mark modified files, and preserve applicable
`NOTICE` attributions. Its contributor patent grant has limits and terminates for
the specified patent litigation; it does not grant general trademark rights.
See the [Apache license](https://www.apache.org/licenses/LICENSE-2.0).

Apache-2.0 is a permissive license, not a promise of no restrictions. It does
not provide warranties or grant every possible third-party right. Dependency
licenses remain independent of this repository's `LICENSE`.
