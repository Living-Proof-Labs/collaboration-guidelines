<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitLab development and verification

## Workspaces

GitLab Workspaces uses a devfile and container image to define a remote development
environment. It does not simply consume `devcontainer.json`, and it is not merely
the browser-based Web IDE editor. Workspaces supplies a running environment on
configured Kubernetes infrastructure; its image must meet GitLab's workspace
requirements.

For future adoption, build a suitable workspace image from the repository Docker
setup, share the development tooling layers where possible, and reference that
image from the devfile. Apply the [shared Task convention](../docs/developer-interface.md)
inside the prepared environment rather than invoking a host Compose wrapper.
Validate workspace-specific image requirements instead of assuming an arbitrary
local development image will work unchanged.

See the official [Workspaces documentation](https://docs.gitlab.com/user/workspace/)
and [remote development overview](https://docs.gitlab.com/user/project/remote_development/).
This is provider guidance only: no devfile, GitLab implementation, infrastructure,
subscription change, or workspace adoption is introduced or claimed here.

## Test-result publication

Have the Task test command generate JUnit XML and configure
`artifacts:reports:junit` with its file paths for GitLab ingestion. Also include
the raw reports in `artifacts:paths`, use `artifacts:when: always` so failure does
not skip ordinary artifact upload, and set an appropriate `expire_in`. Verify
individual cases in the pipeline Tests tab and the merge request test summary;
link these and the retained reports from the change's verification summary.
Keep test names distinct and check parser/file-size limits and expired artifacts
when results are missing. Report malformed or missing expected files as failures.

The test script must exit nonzero when tests fail: report ingestion does not set
job status. Avoid `allow_failure` or shell logic that masks required tests, and
keep release jobs gated on their result. Ensure the test runner writes reports
on ordinary assertion failures, not only on successful completion.

Use the runner's existing artifact mechanism without adding personal tokens.
Keep untrusted fork pipelines isolated from parent secrets and privileged runners;
do not move fork execution into the parent project merely to obtain reporting
access. Document permission or feature gaps and retain whatever evidence the
permitted pipeline can publish. This is guidance, not GitLab pipeline adoption.

See [unit test reports](https://docs.gitlab.com/ci/testing/unit_test_reports/) and
[fork pipeline security](https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/#use-with-forked-projects).
Apply the shared [definition of done](../docs/developer-interface.md#definition-of-done).
GitLab's documented comparisons are provider features; verify the available
history before claiming longer-term trend aggregation.
