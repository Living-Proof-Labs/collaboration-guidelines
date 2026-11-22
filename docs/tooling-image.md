<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Guidelines tooling image

The release pipeline publishes `ghcr.io/living-proof-labs/collaboration-guidelines/tooling`
with immutable guidelines version tags. It does not publish `latest`.

## Publication and evidence

The verification workflow builds native Linux amd64 and arm64 candidates. Each
candidate runs `task verify` inside the image before its exact image archive and
checksum are retained. Docker builds deliberately run on hosts with a daemon;
they cannot run inside the tooling container they are producing.

After verification and a successful semantic release, the publication job loads
those archives without rebuilding. It validates their checksums, architecture
and source revision before pushing either image. It rejects existing version
or architecture tags and fails closed on registry errors. The existing Actions
token has job-scoped Packages write and Contents write access; no GitHub App
credential is used or changed.

The job combines both images into a multiarchitecture index. The release receives
`tooling-index.json` and `tooling-image.json`, including the index digest, source
revision and complete `tag@sha256:...` reference. Index child digests must agree
with both published architecture tags. Candidate archives expire after
seven days. Registry package visibility must be verified before public consumers
adopt the reference; this workflow does not change package visibility settings.

## First publication and adoption

This is the publication slice of [issue #47](https://github.com/Living-Proof-Labs/collaboration-guidelines/issues/47),
not its completion. Until a real release has published both architectures, CI
retains its documented host fallback. After inspecting the release evidence,
make a separate PR that pins the CI verification container and development
container to the same published index digest, with Renovate maintaining that
reference. Do not invent a digest or make a release depend on its own unpublished
image. Later releases build from the Dockerfile, not from the prior tooling image.

## Failures and recovery

An image-publication failure does not undo the already-created source release.
Never overwrite an existing image tag or release asset to hide a partial run.
Record the failed run and affected release, correct the problem, and publish a
new version. If the job fails before any image or evidence publication, an
explicitly reviewed recovery may reuse the retained tested archives, but this
workflow does not silently overwrite or resume a partial publication. A rerun
where semantic release finds no new version does not publish an image, unless
the action recovers a tag at HEAD that has no Release (see [releases](releases.md)).

Local script tests use a fake registry CLI to exercise successful publication,
existing tags, authorization errors, corrupted archives, wrong architecture or
revision, invalid tags, invalid index evidence, mismatched child digests and a registry
failure after the first architecture push. Those tests are not proof of
a successful hosted GHCR publication. The first hosted run must demonstrate both
native test jobs, the published index, and anonymous pull access before adoption.
