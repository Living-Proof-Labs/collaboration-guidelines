<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Documentation ownership decision

The 2026-10-27 read-only audit found useful independently generated manuals but
inconsistent reader entry points and historical organization prose in products.
The [recipe](documentation-recipe.md) chooses three reading homes: root for vision
and discovery, guidelines for shared contribution/engineering standards, and each
project for its own contracts and behavior. The GitHub profile remains a short
welcome linking to root. Independent deployments remain independent.

## Evidence behind the decision

| Audited source | Observation and retained pattern |
| --- | --- |
| [Root directory](https://github.com/Living-Proof-Labs/living-proof-labs.github.io/blob/9191d14eaa5a89e17eb5f68008c2409a1f442f84/index.md) | Listed one hosted manual while six product/spec manual URLs returned HTTP 200; make rendered manuals primary destinations |
| [Organization profile](https://github.com/Living-Proof-Labs/.github/blob/cce66579ff8b0e26279d35a715c0ffac4c70891b/profile/README.md) | Full vision and a separate released-project directory duplicate organization-level ownership |
| [LivingProof](https://github.com/Living-Proof-Labs/livingproof/blob/6184d1d362b69355656bae9fe7712773cb6c2f0d/README.md) | Organization workflow and candidate integrations precede product use; retain its generated installed-command/scenario evidence |
| [Reporter](https://github.com/Living-Proof-Labs/livingproof-capability-report/blob/fa1a4e708f3d1330667967fe420adcdf18cbb8ef/README.md) | Real verification/release/license badges are reusable; pending-publication prose is separate cleanup |
| [Verifier](https://github.com/Living-Proof-Labs/capability-verifier/blob/29b5a250bfc902cd526381dabdc33fb80999535f/mkdocs.yml) | Repository header link and Task/scenario navigation provide useful discovery patterns |
| [Specifications](https://github.com/Living-Proof-Labs/robot-capability-specs/blob/323ebcec62b68633987a2c44f87230639a4cb3c8/README.md) | Shared collaboration/release explanation remains alongside catalog contracts; keep catalog semantics and explicit local approval override |
| [Common](https://github.com/Living-Proof-Labs/livingproof-common/blob/385908b80b049ee69ca64c452759653a0c3dfb65/tools/docs.py) | Installed-wheel API generation, source/result consistency checks, measured coverage, and old-bookmark aliases are useful patterns |
| [MuJoCo](https://github.com/Living-Proof-Labs/livingproof-sim-mujoco/blob/5ecc8d516bf547e7d267ce4e5a3917a6bffce1ea/docs/index.md) | Clear first-use engine example and limits; preserve distinction between engine observations and capability results |
| [Guidelines v5.0.0](https://github.com/Living-Proof-Labs/collaboration-guidelines/tree/v5.0.0) | Baseline resolves to dd4b0391a9a66fa7944f6655aac57c67d3f8c002; existing generation/evidence rules need an ownership/navigation recipe, not a second policy |

The audit inspected live HTML and provenance, not interactive browser behavior.
The Common/Verifier source header links were present; a dynamically displayed
version badge was not independently verified. Combining their source affordance
with exact documentation-revision links is a recommendation, not a claim that
an existing release badge identifies the deployed documentation.

At audit time the guidelines manual path returned HTTP 404. Publishing its full
manual is separate work; its template artifact is not that manual. Product
manuals identified development snapshots, including candidate package metadata;
their source revisions must remain distinct from actual package releases.
These are dated observations, not continuing availability or compatibility claims.

## Adoption sequence and boundaries

Review and release the recipe first. Then establish canonical root destinations,
shorten profile/LivingProof duplicates while preserving their links, publish the
guidelines manual separately, and adopt the released recipe in each repository.
Do not retarget published tags or force all projects into one build or theme.

Existing publication cleanup is tracked by
[Reporter #17](https://github.com/Living-Proof-Labs/livingproof-capability-report/issues/17),
[Verifier #11](https://github.com/Living-Proof-Labs/capability-verifier/issues/11),
[Specs #14](https://github.com/Living-Proof-Labs/robot-capability-specs/issues/14),
[Common #3](https://github.com/Living-Proof-Labs/livingproof-common/issues/3), and
[MuJoCo #3](https://github.com/Living-Proof-Labs/livingproof-sim-mujoco/issues/3).
Coordinate root work with the existing
[portal rollout](https://github.com/Living-Proof-Labs/.github/issues/3).
New adoption work should describe remaining architecture gaps and depend on the
released recipe, not recreate those publication tasks. This decision changes no
other repository, settings, domain, deployment, license, or consumer pin.
