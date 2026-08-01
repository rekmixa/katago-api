FROM node:22.13.1-bookworm-slim

ARG KATAGO_VERSION=v1.16.5
ARG KATAGO_ARCHIVE=katago-v1.16.5-eigenavx2-linux-x64.zip

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    unzip \
  && rm -rf /var/lib/apt/lists/*

# KataGo Linux-релизы — AppImage; в Docker без FUSE извлекаем squashfs
RUN mkdir -p /opt/katago \
  && curl -fsSL \
    "https://github.com/lightvector/KataGo/releases/download/${KATAGO_VERSION}/${KATAGO_ARCHIVE}" \
    -o /tmp/katago.zip \
  && unzip -q /tmp/katago.zip -d /tmp/katago-extract \
  && KATAGO_BIN="$(find /tmp/katago-extract -type f \( -name 'katago' -o -name 'katago-*' \) | head -n 1)" \
  && test -n "$KATAGO_BIN" \
  && chmod +x "$KATAGO_BIN" \
  && cd /tmp/katago-extract \
  && if "$KATAGO_BIN" --appimage-extract; then \
       mv /tmp/katago-extract/squashfs-root /opt/katago/app \
       && ln -sf /opt/katago/app/AppRun /opt/katago/katago; \
     else \
       cp "$KATAGO_BIN" /opt/katago/katago; \
     fi \
  && chmod +x /opt/katago/katago \
  && rm -rf /tmp/katago.zip /tmp/katago-extract \
  && /opt/katago/katago version

ENV KATAGO_BIN=/opt/katago/katago
ENV KATAGO_CONFIG=/home/node/app/katago/analysis.cfg
ENV KATAGO_MODEL=/home/node/app/katago/models/default.bin.gz
ENV KATAGO_MODEL_URL=https://github.com/lightvector/KataGo/releases/download/v1.4.5/g170e-b20c256x2-s5303129600-d1228401921.bin.gz
