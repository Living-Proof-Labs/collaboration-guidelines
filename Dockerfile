# SPDX-License-Identifier: Apache-2.0
# This repository's tooling, not the shared host image or an application runtime.
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS tooling
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY .github/actions/semantic-release/package*.json .github/actions/semantic-release/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm ci --prefix .github/actions/semantic-release --ignore-scripts
COPY . .
CMD ["bash", "tools/host/test.sh"]
