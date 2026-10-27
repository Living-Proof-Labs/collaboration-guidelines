<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Generated documentation and GitHub Pages

## Review artifacts

The [workflow](workflows/generated-docs.yml) builds and verifies the
[template](../templates/generated-docs/README.md) through Task. It uploads HTML and
JUnit test results for 14 days, including available diagnostics after failure.
Individual cases appear in the Actions job summary using the pinned standard
report publisher. The original test exit status remains authoritative.

This workflow uses `contents: read` only. It does not request new write permissions,
create dedicated Checks through the API, deploy Pages, or change settings.
Untrusted pull requests receive no secrets, and verification runs in a container
without network access. Image builds still require public dependency downloads;
source imports and Taskfiles must be reviewed as executable code.

Download the generated-documentation artifact from the workflow run, extract it,
and open `html/index.html`. Retained source coverage pages are intended only for
reviewable public source. Check emitted versus ingested test counts in the summary.
Local links and fragments are checked offline; external link availability is not
part of this fixture's claim. These downloads support review; the repository's
deployed manual is a separate destination with its own verification.

## Repository Pages manual

Each repository hosts its own public GitHub Pages documentation, following the
[manual and completion guidance](../docs/tool-usability.md#a-manual-owned-by-each-repository).
This is the adoption standard, not a statement that this repository's fixture or
all existing repositories already deploy Pages. Implement adoption through a small
repository PR, reusing its documentation build. Do not change organization-wide
settings or enable other repositories as a side effect. Existing authorization
for a specific repository remains valid; resolve any missing setup authority only
for that repository. Review public output, including source in coverage pages,
before publishing.

Use GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
with these boundaries when adapting the repository's existing pipeline:

- Build and verify with Task using the repository's pinned tooling. Configure the
  generator for the actual Pages base path. Upload only the generated public site
  with `actions/upload-pages-artifact`, not the checkout or diagnostic bundle.
- Deploy only from trusted `main`, after the build and checks pass. Limit automatic
  triggers to pushes on `main`; if manual dispatch is offered, also check the ref
  is `refs/heads/main`. Never deploy PR output, run fork code with write privileges,
  or use `pull_request_target` to build documentation.
- Keep build/PR jobs at `contents: read`. Put `pages: write` and `id-token: write`
  only on a separate deployment job using `actions/deploy-pages`, with `needs`
  pointing to the successful build job. That job deploys the artifact without
  checking out or executing project code. Use the `github-pages` environment,
  scoped to `main`, and expose the deployment's `page_url` as its environment URL.
- Pin reviewed Action revisions, following the existing repository convention.
  Serialize deployments so an older run cannot overwrite a newer manual. Keep
  ordinary review downloads at the 14-day default; the Pages transfer artifact
  is deployment transport, not the durable manual or a user download promise.
- Verify the actual public URL and live navigation/search after deployment, then
  add the prominent README link. Record the deployed source revision and run;
  settings or a successful upload alone do not establish a working site.

The existing artifact workflow above remains unchanged. A consumer must implement
and verify its Pages deployment; this guide neither enables Pages nor installs a
new workflow. The livingproof deployment is separate repository work.
