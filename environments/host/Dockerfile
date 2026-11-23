# SPDX-License-Identifier: Apache-2.0
# Reusable host image; project language runtimes belong in repository images.
ARG HOST_BASE=ubuntu:24.04@sha256:9c7f200c07e3d4a03e7249d2c16bf66a51120fb876aa2242cf31451412543289
FROM ${HOST_BASE}
COPY environments/host/ /opt/living-proof-host/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export CURL_CA_BUNDLE=/run/secrets/ca; fi; \
    bash /opt/living-proof-host/install.sh
WORKDIR /workspace
CMD ["bash"]
