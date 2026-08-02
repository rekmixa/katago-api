# Versions

## [Unreleased]

## [1.2.0] - 2026-08-02

### Added
- Telegram bot container (`yarn telegram`): hourly queue report to channel; `/start` (public chatId), `/ping` + `/sendReport` for `TELEGRAM_ADMIN_IDS`; env `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADMIN_IDS`, `TELEGRAM_API_URL`

### Changed
- Worker image: KataGo **TensorRT** (`trt10.2.0-cuda12.5`) instead of CUDA/cuDNN binary; base `nvidia/cuda:12.5.1-runtime` + pinned `libnvinfer10` 10.2.0
- `analysis.cfg`: `homeDataDir` for TRT timing cache, `trtDeviceToUse=0`; threads/batch/cache for L4 (`32×1`, batch 32, cache 21)
- Defaults: `KATAGO_READY_TIMEOUT_MS=600000`, `KATAGO_IDLE_STOP_MS=60000` (first TRT init is slow)

## [1.1.2] - 2026-08-02

### Added
- `make db-dump` — Postgres dump via `pg_dump` into gitignored `db-backups/` (`DB_USER` / `DB_NAME` from `.env`)
- `bench-katago.sh` — collect GPU/RAM/swap/`vmstat`/docker stats and recent worker timings into `bench-logs/`
- README notes for the bench script

### Changed
- `analysis.cfg`: lower NN cache to reduce host RAM pressure (`nnCacheSizePowerOfTwo` 23 → 20)
- `analysis.cfg`: prefer more parallel positions with one search thread (`numAnalysisThreads=24`, `numSearchThreadsPerAnalysisThread=1`, `nnMaxBatchSize=24`)

## [1.1.1] - 2026-08-02

### Added
- CLI `queue:requeue-failed` — move failed jobs back to `pending` (all, or one via `--job-id` / `-j`); clears `error`, `attempts`, `started_at`, `finished_at`
- Queue worker log after each job: final status (`done` / `failed` / `retry` / `error`) and that the queue is idle again

### Fixed
- After a KataGo query timeout the engine stayed alive and pegged CPU, which froze the worker cron on a 2-core VM — now SIGKILL on timeout
- Faster KataGo terminate on idle-stop; stderr logging throttled so Nest event loop is less likely to stall under load

## [1.1.0] - 2026-08-02

### Added
- `POST /api/analyze/batch` — enqueue up to 1000 SGFs at once (one job per game; per-item `queued` / `exists` / `error` + `sgfMd5`)
- Separate `worker` container (`WorkerModule` / `yarn worker`) for queue + KataGo
- Lightweight API image `docker/node/Dockerfile.api` (no CUDA/KataGo)
- Configurable JSON body limit (`BODY_LIMIT`, default `50mb`) for large batches
- KataGo idle shutdown (`KATAGO_IDLE_STOP_MS`) and ready wait (`KATAGO_READY_TIMEOUT_MS`)

### Changed
- API (`node`) no longer runs the queue worker or mounts GPU
- Worker image keeps CUDA KataGo; prod/dev compose split `node` vs `worker`
- `analysis.cfg`: higher default quality (`maxVisits=500`, threads `8×2`, `nnMaxBatchSize=16`)
- Worker scripts use `nest build && node dist/src/worker` (Nest CLI 8 has no `--entryFile`)

### Fixed
- `413 request entity too large` on big analyze batches (Express default ~100kb)
- KataGo leaving CPU pegged at 100% after jobs finish (stop process when idle)

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
