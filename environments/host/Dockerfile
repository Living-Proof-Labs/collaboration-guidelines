# SPDX-License-Identifier: Apache-2.0
# Reusable host image; project language runtimes belong in repository images.
ARG HOST_BASE=ubuntu:24.04@sha256:68ee22004a9109b44973313b02ff7b1de250f1de0f5ecb628d73f579aaff33ac
FROM ${HOST_BASE}
COPY environments/host/ /opt/living-proof-host/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export CURL_CA_BUNDLE=/run/secrets/ca; fi; \
    bash /opt/living-proof-host/install.sh
WORKDIR /workspace
CMD ["bash"]
