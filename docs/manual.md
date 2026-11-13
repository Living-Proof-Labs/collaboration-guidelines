<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Build and verify this manual

This manual renders the repository's Markdown and actual Task definitions.
Start by reading the [working agreement](../AGENTS.md), adopting a published tag,
and following the [developer interface](developer-interface.md). The
[documentation recipe](documentation-recipe.md) defines ownership and navigation.
The organization vision/directory stays at
[Documentation home](https://docs.livingprooflabs.com/).

## Preview and validation

The host needs Docker and Task 3.54.0. Run:

```sh
task manual:build
task manual:verify
python3 -m http.server --directory artifacts/manual/html 8000
```

The pinned tooling container generates HTML and runs document and Chromium browser
checks without network access. `artifacts/manual/html/index.html` is the preview;
`artifacts/manual/tests.xml` records individual checks. Review downloads retain
14 days. The durable [published manual](https://docs.livingprooflabs.com/collaboration-guidelines/)
is separate from these temporary review downloads.

Verification rebuilds the source snapshot using cached dependency layers and
embeds its identity in the image. Prior local manual output is retained in a
separate `artifacts/manual-previous.*` directory; failed generation cannot silently
reuse it as the current manual. Hosted review downloads include only current output.

In an already prepared environment with the locked Python tools and Task, run
`python tools/manual/brand.py` once to fetch the locked stylesheet, then
`bash tools/manual/verify.sh`. Do not invoke Docker wrappers inside that
environment. The container uses the same script and project sources.

The generated Task reference comes from native `task --list --json` and
`task --summary`; it does not execute task bodies. Only this repository's reviewed
Taskfile is included. Source pages and the version page identify the exact build
commit and dirty state. A current manual is not a guarantee about older pins.

## Released brand and recipe

The manual adopts the documentation recipe and shared docs brand from
[v7.10.9](https://github.com/Living-Proof-Labs/collaboration-guidelines/tree/v7.10.9),
resolved to `c5fa9d9794d0ebd289f51b247fe7872de0db9c27`.
Existing authored pages, navigation labels, URLs and fragment anchors remain
canonical. Current manual and documentation-home links are navigation exceptions
to release pinning, as allowed by that recipe; they do not select build inputs.

`docs-brand.lock.json` records the released tag, resolved commit and stylesheet
SHA-256. Image preparation downloads the stylesheet from that exact commit and
rejects a checksum mismatch. Offline generation verifies the prepared bytes again
and stages them at `assets/brand.css`; it never reads the working-tree brand CSS.
Update all lock fields together after resolving a published release. The Version
and source page and `build.json` retain this provenance separately from the
manual's development commit. This adoption does not enable Renovate or automerge.

The shared stylesheet selects teal in both themes and Instrument Serif headings.
Its Google Fonts import needs network access; offline visitors retain the declared
Georgia/serif fallback. Offline browser checks verify computed styling and local
assets, not external font delivery.

## Scope and evidence

This is shared guidance, not an application package or robot verifier. There is
no product CLI/API or capability scenario suite to invent. The
[generated-documentation template](../templates/generated-docs/README.md) contains
a demonstration CLI and its own test/coverage artifacts; those describe the
example only, not this manual's functionality or coverage. No manual software
line-coverage percentage is measured. Existing release-policy and shared-host
checks remain separate verification evidence.

Document tests check generated links/fragments, source hashes and real Task
references. Browser checks exercise the repository base path, search and opening
a result, deep-link reload, source/root navigation and mobile navigation. Offline
checks do not establish remote availability. Independent review must use the
generated artifact and report the exact source and observed limits.

Help and corrections use this repository's Issues. License scopes remain in the
[license index](../LICENSE.md). No dedicated security-reporting destination has
been established here; this manual does not invent one or direct sensitive reports
to public issues.

## Publication

The main-only manual workflow uses a separate Pages deployment job after verified
generation. Build and PR jobs remain read-only; deployment has no checkout or
project execution. Publication requires repository Pages configured for GitHub
Actions and the `github-pages` environment restricted to main. No project CNAME,
DNS, mail, or organization change is needed. The repository is configured for
this publication path.

Initial publication was verified at source commit
`cd434afa1ce9fdb7bb5aff394222622b18657199` in
[manual run 40470273136](https://github.com/Living-Proof-Labs/collaboration-guidelines/actions/runs/40470273136).
Live HTTPS, source identity, nested pages, desktop search/result reload, theme
persistence, and source/root navigation passed. Mobile navigation was verified
against the generated artifact; live mobile acceptance is not claimed.

For subsequent delivery checks, verify the actual deployed URL,
source/run identity, nested pages, browser search and result opening, desktop and
mobile navigation, theme behavior, and source/root/help/license destinations.
Record failures honestly; a successful artifact upload alone is not publication.
