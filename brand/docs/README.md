<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Docs brand

`brand.css` is the single, versioned brand style for every Zensical manual under
docs.livingprooflabs.com. It was imported unchanged from the publisher
(`living-proof-labs.github.io` `docs/brand.css` at
`a133e52a72370c6cbdcc16f924a77d70ae989216`). Change the brand here and in no
other repository.

## Consuming a release

Do not copy this file into a repository. Each docs site pins one release in a
`docs-brand.lock.json` at its root:

```json
{
  "repository": "Living-Proof-Labs/collaboration-guidelines",
  "version": "vX.Y.Z",
  "commit": "<40-character commit of vX.Y.Z>",
  "path": "brand/docs/brand.css",
  "sha256": "<sha256 of the file at that commit>"
}
```

The docs build downloads
`https://raw.githubusercontent.com/<repository>/<commit>/<path>`, refuses it
unless its sha256 matches, and stages it as `assets/brand.css`. `version` is the
human-readable and Renovate-readable label; `commit` and `sha256` make the
download immutable even if a tag moves.

The manual's `mkdocs.yml` then declares only:

```yaml
theme:
  palette:
    - media: '(prefers-color-scheme)'
      primary: custom
      accent: custom
    - media: '(prefers-color-scheme: light)'
      scheme: default
      primary: custom
      accent: custom
    - media: '(prefers-color-scheme: dark)'
      scheme: slate
      primary: custom
      accent: custom
extra_css:
  - assets/brand.css
```

`primary: custom` and `accent: custom` stop Zensical from falling back to its
stock indigo palette; the colours come only from `brand.css`.

Each consumer should keep a render check that builds its manual and fails if
any page lacks `assets/brand.css` or carries `data-md-color-primary="indigo"`.

## Upgrading

1. Change `brand.css` here in a reviewed pull request; the release workflow tags
   it with the rest of this repository.
2. In each docs repository, update `version`, `commit` and `sha256` together in
   one pull request, and let its render check pass.

The shared preset includes a disabled-by-default docs brand manager. After the
runner and consumer checks are bootstrapped, the opt-in preset regenerates all
three fields in the same Renovate pull request. Follow the
[Renovate brand update procedure](../../tools/docs-brand/README.md); do not enable
a version-only updater or edit checksums merely to make a failed build pass.
