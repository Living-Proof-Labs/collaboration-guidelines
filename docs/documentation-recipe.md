<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- markdownlint-configure-file { "MD013": { "tables": false } } -->

# Documentation ownership and manual recipe

Readers should find the organization, choose a manual, and understand exactly
which software or contract it describes. Use this recipe with the existing
[generation and publication rules](tool-usability.md),
[developer interface](developer-interface.md), and
[independent review procedure](independent-review.md). It organizes those rules;
it does not replace their verification requirements or enable any deployment.

## One owner for each subject

| Subject | Canonical owner | Other destinations |
| --- | --- | --- |
| Organization vision, ecosystem status, and manual directory | Root documentation site in `living-proof-labs.github.io` | Short summaries link here |
| GitHub organization welcome | `.github/profile/README.md` | Short mission, scope, and prominent root documentation link |
| Shared contribution and engineering standards, including this recipe | `collaboration-guidelines` | Consumers link to their explicitly adopted release and state local additions/overrides |
| Capability requirements, conditions, acceptance criteria, and contract revisions | `robot-capability-specs` | Executors and reporters reference the contracts they actually consume |
| Product behavior, installation, public interfaces, and limitations | The owning product repository | Root offers a short description and opens its rendered manual |

The owner may call `.github` the conceptual organization root. GitHub's profile
publication and organization Pages hosting are separate mechanisms: the profile
is in `.github`; the root site is in `living-proof-labs.github.io`. Keep full
vision prose in the root site and link from the short profile. Do not add remote
includes, a cross-repository build, or copies of product manuals to achieve this.

Product contracts remain with their implementer: for example, the reporter owns
its bundle schema and grading/rendering behavior, while specs owns capability
requirements. LivingProof owns its umbrella command and plugins; Common owns
its library APIs; Verifier owns fixture execution/evidence; MuJoCo owns native
engine execution. Summarize dependencies and link instead of copying their guides.
An executable MuJoCo example does not establish a capability-pipeline integration.

Keep repository Markdown canonical for authored explanations. Generate reference
and result pages from their actual sources; do not edit generated prose as a
second source. Preserve attribution and existing license scopes when moving text.
See the [ownership decision and audit](documentation-ownership.md).

## Required, conditional, and optional content

Use common offerings, not empty pages or identical menus regardless of scope.
Record an inapplicable item in the adoption review rather than inventing a feature.

| Level | Offering | Reader outcome |
| --- | --- | --- |
| Required | Start here | Understand scope, current limitations, and the first useful action or reading path |
| Required | Navigation and discovery | Reach documentation home, this manual's source, and relevant related manuals |
| Required | Version and source | Identify documentation revision, supported context, and current/historical-manual policy |
| Required | Contribute, help, and licensing | Find the real contribution path, issue/support destination, and applicable license scopes |
| Conditional: shipped software | Installation and quickstart | Choose a supported artifact/version and reproduce a useful example with expected output |
| Conditional: command interface | Command reference | Read generated actual Click, argparse, or other native help; understand exits and errors |
| Conditional: public library API | API reference | Read signatures/docstrings from the tested package, with a consumer example |
| Conditional: data or capability contract | Contract reference | Understand schemas, acceptance semantics, versions, and compatibility boundaries |
| Conditional: Task exists | Contributor tasks | Read generated Task descriptions and command summaries, with execution context |
| Conditional: executable scenarios exist | Scenarios and results | Trace named behavior to actual outcomes, source revision, run, and remaining gaps |
| Conditional: measured software coverage exists | Coverage report | Inspect measured coverage with scope, inputs, and evidence context |
| Optional | Tutorials, architecture, migration, roadmap, history | Go deeper where readers need it, without obscuring first use |

Documentation-only repositories use reading/authoring examples and applicable
document checks. They need no dummy CLI, API, runtime, or executable feature suite.
The root directory and GitHub profile retain their explicit lightweight editorial
validation exceptions; this recipe does not require Task, Docker, releases, or a
search service for those small surfaces. Other exceptions remain explicit local
overrides, not implicit adoption claims.

For Task repositories, generate from the reviewed Taskfiles using native
`--list --json` and `--summary` information, as described in
[tool usability](tool-usability.md#generate-reference-pages-from-the-actual-tools).
Identify host wrappers and prepared-container commands so readers do not recurse
through Docker. Do not publish private/internal tasks indiscriminately or execute
arbitrary Taskfiles just to discover commands. Keep generation in the existing
documentation build, and check freshness alongside actual CLI/API references.

## Consistent navigation

Put **Start here: documentation** near the top of each README, linking to its
verified live manual. The root directory's primary destinations are rendered
manuals; Source and Release links are secondary. Until a manual is verified,
label the source/preview and its availability honestly rather than guessing a URL.

Use these labels in a predictable order, omitting inapplicable offerings:

1. **Documentation home**: the organization root, available from every manual.
2. **Start here**: the current manual's landing page.
3. **Guides**: installation, quickstart, and scoped explanations.
4. **Reference**: applicable **Commands**, **API**, **Tasks**, or **Contracts**.
5. **Scenarios and results**: observable behavior and recorded outcomes.
6. **Verification**: reproduction, measured coverage, and limitations.
7. **Contribute**: adopted shared standards and local instructions.
8. **Version and source**: documentation identity, evidence, and historical policy.

Keep **Source**, **Help / report an issue**, and **License** easy to find in the
header or footer. Link **Security** only to an established reporting destination;
do not invent an address, imply private reporting is enabled, or send sensitive
reports to public issues by default. Record a missing security route as a gap.
Put publication operations and historical investigations below normal reader tasks.

Use the canonical `https://docs.livingprooflabs.com/` for Documentation home;
resolve it from nested pages rather than using a fragile `../` chain. The local
Home/logo link may still open the product landing. Related-manual links should
open the relevant rendered explanation; the root provides the complete directory.
Keep navigation usable on mobile and by keyboard, including without badge scripts.

Current manual/root/source-directory links are intentional navigation exceptions
to cross-repository version pinning. Record this bounded exception in the adopting
repository; it does not permit floating guidance, dependencies, templates,
downloads, or executable examples. A current rendered guide is a reading aid,
not a replacement for fetching the explicitly adopted version of shared rules.

## Version links and truthful badges

Reuse a visible GitHub/source header affordance, with a separate documentation
identity link. Prefer plain accessible text when a badge adds no information.
Do not rely on a third-party badge or a client-side release lookup for identity.

| Label | Meaning and destination |
| --- | --- |
| Docs: development · short commit | Exact immutable source tree/commit used to build this manual; full hash in Version and source |
| Docs: released version | Only when the manual actually describes that released revision; link its tag and record the resolved commit |
| Package release: version | Actual published package release; separate from documentation or test-candidate identity |
| Catalog/guidelines release: version | Actual published source release where no application package exists |
| Verification: workflow/branch | Real workflow and its results; scope named, not a universal product-quality claim |
| Documentation | Verified rendered reading destination, not evidence that a particular deployment passed |
| License | Accurate license index or scoped terms; mixed prose/code/spec licenses stay explicit |
| Software coverage: measured value | Optional measured report for identified inputs, never an invented or static percentage |

A moving development manual can describe a candidate built with `0.0.0` or a
development package version. Do not label that candidate a stable release, even
if a newer release appears in the repository header. Keep source commit, package
metadata, tested dependency versions, and verification run distinguishable.
Only advertise maintained historical manuals; otherwise link source release tags
and state the limit. Exact source SHA links identify evidence, not a substitute
for published version-tag dependencies.

Reuse existing scenario/result generation rather than a parallel inventory.
Show passed, failed, skipped, and untested outcomes at the tested revision, with
stable scenario identities and missing/unspecified behavior visible. If reporting
a percentage, name the denominator. A test that correctly detects a capability
failure can pass: test outcome and capability grade are different fields.
Line coverage is separate from scenario completeness, capability, quality, safety,
and sufficiency of evidence. If no coverage was measured, say so.

## Adoption checklist

Use a focused repository PR after the recipe is reviewed and published. Until
then, this change is review material; do not claim the recipe is in v5.0.0 or
invent the next version tag. New required navigation/ownership expectations alter
the adopted contract and must be assessed under the
[release compatibility policy](../CONTRIBUTING.md#version-the-shared-contract).

- [ ] Inventory existing authored/generated pages, URLs/fragments, Taskfiles,
  public interfaces, tests/results, licenses, and existing adoption work.
- [ ] Select the published guidelines tag containing this recipe, resolve its
  commit, read it, and record local additions and justified exceptions.
- [ ] Assign each subject to its canonical owner; create target content before
  replacing duplicates with short links. Preserve licensing and attribution.
- [ ] Apply required and applicable offerings, common navigation, accurate
  badges, and separate documentation/source/package identities.
- [ ] Preserve published deep links and fragment bookmarks with retained anchors,
  forwarding pages, or tested redirects; update internal links to final targets.
- [ ] Keep exact dependency/template/workflow pins. An AGENTS update does not
  silently upgrade release workflows or known-good demonstration dependencies.
- [ ] Run existing documentation checks and applicable generation/result checks;
  verify local paths/fragments and separately check remote destinations.
- [ ] Obtain independent review using the existing procedure. Keep checks and
  evidence scoped to the actual change; no new publishing settings by implication.
- [ ] After authorized deployment, verify the README-to-manual journey, root and
  sibling discovery, desktop/mobile/keyboard navigation, deep-link reload, and
  applicable search with a known term and opening its result.
- [ ] Match live source identity to the deployment and result inputs. Exercise
  badge destinations and check usable navigation if badge scripts are unavailable.
- [ ] Record URL, source, run, outcomes, and remaining limits. Follow the existing
  14-day review-artifact default and documented exceptions; the live manual is
  separate from expiring downloads. Add its root-directory entry after acceptance.

Reuse prepared publication cleanup and existing issues rather than creating
duplicate work. Apply this recipe through deliberate per-repository adoption;
publishing these guidelines does not itself migrate content or enable Pages.
