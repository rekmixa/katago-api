# Worker image: Node + KataGo TensorRT (matches official trt10.2.0-cuda12.5 binary)
FROM nvidia/cuda:12.5.1-runtime-ubuntu22.04

ARG KATAGO_VERSION=v1.16.5
ARG KATAGO_ARCHIVE=katago-v1.16.5-trt10.2.0-cuda12.5-linux-x64.zip
# Pin to the same TensorRT minor as the KataGo release label (trt10.2.0).
ARG TRT_VERSION=10.2.0.19-1+cuda12.5
ARG NODE_MAJOR=22

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    gnupg \
    unzip \
    libnvinfer10=${TRT_VERSION} \
    libnvinfer-plugin10=${TRT_VERSION} \
    libnvonnxparsers10=${TRT_VERSION} \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g yarn \
  && rm -rf /var/lib/apt/lists/*

# KataGo Linux releases are AppImage; extract squashfs (no FUSE in Docker).
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
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
# TensorRT timing cache lives under homeDataDir (see analysis.cfg).
ENV HOME=/home/node
