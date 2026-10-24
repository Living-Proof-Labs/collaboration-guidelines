<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Licensing pattern for future repositories

Use [this repository's scope index](../LICENSE.md) as a starting point when the
owner authorizes this licensing pattern in another repository. This guide does
not relicense existing repositories or third-party content.

## Apply clear scopes

1. Inventory original code, prose, data, and third-party material. Confirm that
   the project can license what it owns; preserve others' licenses and notices.
2. Use Apache-2.0 for original tooling/code and CC BY 4.0 for original guidelines
   and documentation when this pattern fits the project. State exceptions.
3. Include full, unmodified texts from the publishers and a root license index
   mapping paths/materials to each license. Use SPDX identifiers in source
   comments and manifest license fields where the format supports them.
4. Explicitly license reusable examples and templates as code, even within prose
   documentation. This repository uses Apache-2.0 for those examples.
5. Record the scope and rationale in the PR. Preserve any applicable third-party
   NOTICE material when redistributing; do not invent attribution or ownership.

## Reuse with the terms intact

Apache-2.0 permits commercial use and modification. When redistributing, provide
the license, retain relevant notices, mark modified files, and preserve applicable
NOTICE attributions. Its contributor patent grant has limits and terminates for
the specified patent litigation; it does not grant general trademark rights.
See the [Apache license](https://www.apache.org/licenses/LICENSE-2.0).

CC BY 4.0 permits commercial sharing and adaptation. Give appropriate credit,
link the license and source, retain supplied notices, and indicate changes
without implying endorsement. Do not add legal or technical restrictions that
prevent recipients exercising the licensed rights. See the
[CC BY 4.0 summary](https://creativecommons.org/licenses/by/4.0/) and
[full legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en).

An attribution for adapted prose could be: "Adapted from Living Proof Labs
collaboration guidelines, [source revision URL], licensed under CC BY 4.0
[license URL]. Changes: [brief description]." Replace placeholders with real
links and describe the actual changes.

These are permissive licenses, not a promise of no restrictions. Neither license
provides warranties or grants every possible third-party right. Dependency
licenses remain independent of this repository's scope index.
