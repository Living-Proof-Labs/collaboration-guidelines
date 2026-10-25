<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitHub Codespaces

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
