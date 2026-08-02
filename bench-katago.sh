#!/usr/bin/env bash
# Collect host/GPU/worker metrics to judge KataGo analysis efficiency.
# Usage (on prod):
#   ./bench-katago.sh           # default: 20 samples, 1s interval
#   ./bench-katago.sh 30 1      # 30 samples every 1s
#   ./bench-katago.sh 15 2      # 15 samples every 2s

set -euo pipefail

SAMPLES="${1:-20}"
INTERVAL="${2:-1}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${ROOT}/bench-logs"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${OUT_DIR}/bench_${STAMP}.txt"
WORKER="${PROJECT:-katago-api}_worker"

mkdir -p "${OUT_DIR}"

exec > >(tee "${OUT}") 2>&1

echo "=== kataGo bench ${STAMP} ==="
echo "host: $(hostname)"
echo "cwd:  ${ROOT}"
echo "samples=${SAMPLES} interval=${INTERVAL}s"
echo

echo "=== free -h ==="
free -h || true
echo

echo "=== swapon --show ==="
swapon --show || true
echo

echo "=== vmstat 1 5 ==="
vmstat 1 5 || true
echo

echo "=== nvidia-smi ==="
nvidia-smi || true
echo

echo "=== docker stats (no-stream) ==="
if command -v docker >/dev/null 2>&1; then
  docker stats --no-stream --format \
    'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.BlockIO}}\t{{.PIDs}}' \
    2>/dev/null | grep -E 'NAME|katago|NAME' || docker stats --no-stream || true
else
  echo "docker not found"
fi
echo

echo "=== worker KataGo config (from logs) ==="
if command -v docker >/dev/null 2>&1; then
  docker logs "${WORKER}" 2>&1 | grep -E \
    'nnCacheSizePowerOfTwo|nnMaxBatchSize|numAnalysisThreads|numSearchThreads|Model name|Cuda backend|Analyzing up to' \
    | tail -n 30 || true
else
  echo "docker not found"
fi
echo

echo "=== recent worker job timings ==="
if command -v docker >/dev/null 2>&1; then
  docker logs --tail 200 "${WORKER}" 2>&1 | grep -E \
    'Parsed job|finished with status|Sending KataGo query|timed out|SIGKILL|idle for' \
    | tail -n 40 || true
else
  echo "docker not found"
fi
echo

echo "=== nvidia-smi dmon (${SAMPLES} x ${INTERVAL}s) — run during an active job ==="
if command -v nvidia-smi >/dev/null 2>&1; then
  # -s u: SM util + mem util
  nvidia-smi dmon -s u -d "${INTERVAL}" -c "${SAMPLES}" || true
else
  echo "nvidia-smi not found"
fi
echo

echo "=== free -h (after sample) ==="
free -h || true
echo

echo "=== summary hints ==="
echo "- GPU healthy under load: SM% often tens+, not stuck at 0-5% the whole window"
echo "- b18 + few CPU cores: low average SM% can still be OK if jobs are fast"
echo "- Watch swap used / si in vmstat — growth means RAM bottleneck"
echo "- Compare Parsed→finished gaps vs moves count (~sec/move)"
echo
echo "Saved: ${OUT}"
