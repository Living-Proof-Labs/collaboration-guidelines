<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# GitLab Workspaces

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
