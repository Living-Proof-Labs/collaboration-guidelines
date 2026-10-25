<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitHub development and verification

## Codespaces

Codespaces creates a development environment from `devcontainer.json`, normally
in `.devcontainer/`. Follow the [shared environment convention](../docs/developer-interface.md):
reference the repository Dockerfile and development target, or use
`dockerComposeFile` and `service` to select the existing Compose tooling service.
Keep tool installation in that shared Docker setup. Configure editor integration,
workspace paths, and lifecycle commands in the development-container file.

In the two-file Task layout, setup runs `task -t Taskfile.runtime.yml setup` and
verification runs `task -t Taskfile.runtime.yml verify` inside the container.
Do not call the host Compose wrapper from these lifecycle commands.

See the official [development-container introduction](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers)
and [Dockerfile and Compose guide](https://containers.dev/guide/dockerfile).
These are configuration instructions, not evidence that this repository has a
Codespaces configuration or that a hosted environment has been tested.

## Test-result publication

Have the Task test command emit machine-readable results as well as useful console
output. Select a reviewed, pinned report publisher that parses the chosen format
and exposes individual cases and failures through GitHub Checks. Verify its actual
presentation and failure behavior; GitHub artifact upload alone does not parse
JUnit reports or establish historical test trends.

Run report parsing, summary, and upload steps after test failure, for example with
`if: ${{ !cancelled() }}`. Keep the test step's nonzero outcome; do not use
`continue-on-error` without a final gate that restores failure. A separate report
job must run despite a failed dependency and must not replace the test/release
gate. Missing or invalid reports must surface as reporting failures. Write counts
and links to the check, run, and raw reports through `GITHUB_STEP_SUMMARY`; retain
reports with `actions/upload-artifact` and an explicit `retention-days` value.

A Checks publisher may need `checks: write`; scope only its required permissions
to the publishing job. Fork pull requests normally receive a read-only token:
keep tests unprivileged and retain permitted summaries/artifacts, identifying any
missing Checks publication. Do not grant secrets or write tokens to fork code,
or use `pull_request_target` to execute it. If a separately reviewed trusted
publisher is used, treat reports as untrusted data, verify their source run and
commit, and never execute downloaded content. Do not change repository security
settings just to make a reporting step pass.

References: [check-run permissions](https://docs.github.com/en/rest/checks/runs#create-a-check-run),
[job summaries](https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions#adding-a-job-summary),
[artifact retention](https://docs.github.com/en/actions/tutorials/store-and-share-data),
and [untrusted workflow input](https://docs.github.com/en/actions/reference/security/secure-use).
Apply the shared [definition of done](../docs/developer-interface.md#definition-of-done);
a successful publisher job is not evidence that tests passed or trends exist.
