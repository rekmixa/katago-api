# Versions

## [Unreleased]

# [1.0.0] - 2026-08-01

### Added
- Job queue (`jobs` table, single-threaded worker, `FOR UPDATE SKIP LOCKED`)
- KataGo Analysis Engine integration (long-lived process, JSONL stdin/stdout)
- SGF parse → KataGo query pipeline (`@sabaki/sgf`, GTP moves, rules/komi/board size)
- `POST /api/analyze` and `GET /api/analyze/:jobId` with per-move winrate, score lead, and top-10 alternatives
- Deduplication of identical SGFs via `sgf_md5` (`409` with existing `jobId`)
- Docker images for CUDA (GPU) and Eigen (CPU) KataGo backends
- `analysis.cfg` tuned for NVIDIA L40S-4Q (4 GB VRAM)
- Traefik v2 production compose labels (HTTP/HTTPS + Let's Encrypt cert resolver)
- Bearer token auth for `/api/*` (`API_TOKEN`)
- README: install, GPU/NVIDIA Container Toolkit setup, and analysis flow docs
