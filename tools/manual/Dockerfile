# SPDX-License-Identifier: Apache-2.0
FROM ghcr.io/astral-sh/uv:0.12.23@sha256:61d393e44e249f2e4b526b6c7ddcecce245946826e608e11c93ad4f5bba55b21 AS uv
FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /work
COPY tools/manual/requirements.lock /tmp/requirements.lock
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    uv pip sync --system --require-hashes /tmp/requirements.lock
RUN python -m playwright install --with-deps chromium
COPY templates/generated-docs/install-task.py /tmp/install-task.py
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    python /tmp/install-task.py
COPY . .
ARG SOURCE_COMMIT
ARG SOURCE_DIRTY
ENV PYTHONDONTWRITEBYTECODE=1 SOURCE_COMMIT=$SOURCE_COMMIT SOURCE_DIRTY=$SOURCE_DIRTY
CMD ["bash", "tools/manual/verify.sh"]
