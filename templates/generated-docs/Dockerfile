# SPDX-License-Identifier: Apache-2.0
FROM ghcr.io/astral-sh/uv:0.12.23@sha256:61d393e44e249f2e4b526b6c7ddcecce245946826e608e11c93ad4f5bba55b21 AS uv
FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c AS documentation
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /docs
COPY requirements.lock .
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    uv pip sync --system --require-hashes requirements.lock
COPY install-task.py .
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    python install-task.py
COPY fixture/ fixture/
COPY guide/ guide/
COPY tests/ tests/
COPY Taskfile.yml .coveragerc example.json generate.py links.py ./
ENV PYTHONPATH=/docs PYTHONDONTWRITEBYTECODE=1 SOURCE_DATE_EPOCH=0
CMD ["task", "verify"]
