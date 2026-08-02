# katago-api

> Nest TS
> Knex
> nest-commander

## Установка

```bash
make cp-env
```

##### После этого настрой приложение в файле `.env`

Для production с Traefik v2 в `.env` укажи:

```bash
COMPOSE_FILE=docker-compose.v2.prod.yml:docker-compose.override.yml
```

```bash
make install
make migrate
make seed
```

Просмотр логов Docker-контейнеров:

```bash
make logs
make logs-node
make logs-worker
```

## GPU (NVIDIA) на новом сервере

Сначала убедись, что драйвер NVIDIA работает на хосте:

```bash
nvidia-smi
lspci | grep -i nvidia
```

Если `nvidia-smi` ок, а Docker падает с  
`could not select device driver "nvidia" with capabilities: [[gpu]]`, установи NVIDIA Container Toolkit:

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Проверка доступа к GPU из Docker:

```bash
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

Затем подними проект:

```bash
docker-compose build --no-cache node
docker-compose up -d
```

`katago/analysis.cfg` настроен под NVIDIA L40S-4Q (4 GB VRAM):

```
maxVisits = 500
numAnalysisThreads = 16
numSearchThreadsPerAnalysisThread = 1
nnMaxBatchSize = 16
nnCacheSizePowerOfTwo = 20
```

Если возвращается swap / CUDA OOM — уменьши `numAnalysisThreads` и `nnMaxBatchSize` вместе.

## Как анализируются партии

Пайплайн: **SGF → очередь → KataGo Analysis Engine → JSON в БД**.

### API

Все методы под `/api/*` требуют заголовок:

```http
Authorization: Bearer <API_TOKEN>
```

Токен задаётся в `.env` (`API_TOKEN`, см. `.env-dist`). Без токена или с неверным — `401`. Эндпоинт `/ping` без авторизации.

**Поставить анализ в очередь**

```http
POST /api/analyze
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{
  "sgf": "(;FF[4]GM[1]SZ[19]KM[6.5]RU[Japanese];B[pd];W[dp];...)",
  "maxVisits": 100
}
```

- Обязательное поле: `sgf`.
- Опционально можно передать параметры KataGo Analysis Engine (`maxVisits`, `analyzeTurns`, `rules`, `komi`, `includeOwnership`, `includePolicy`, …) — они уходят в payload джобы и в запрос к KataGo.
- Успех: `{ "jobId": 123 }`.
- Пустой `sgf` → `400`.
- Такой же SGF уже анализировался → `409` и `jobId` существующего результата (новый джоб не создаётся). Дубликат определяется по **MD5** от `trim(sgf)`.

**Поставить пачку SGF в очередь**

```http
POST /api/analyze/batch
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{
  "sgfs": [
    "(;FF[4]GM[1]SZ[19];B[pd];W[dp])",
    "(;FF[4]GM[1]SZ[19];B[qd];W[dd])"
  ],
  "maxVisits": 500
}
```

- Обязательное поле: `sgfs` (массив строк, **1…1000**).
- Общие опции KataGo (как у одиночного `POST /api/analyze`) применяются ко всем элементам.
- На каждый SGF создаётся **отдельная** джоба (если ещё не было такого MD5).
- Ответ: `{ "results": [ ... ] }` — по одному элементу на каждый индекс (`sgfMd5` — MD5 от `trim(sgf)`, для пустого SGF — `null`):
  - `{ "index": 0, "sgfMd5": "…", "status": "queued", "jobId": 123 }` — поставлено в очередь
  - `{ "index": 1, "sgfMd5": "…", "status": "exists", "jobId": 45 }` — такой SGF уже есть
  - `{ "index": 2, "sgfMd5": null, "status": "error", "error": "sgf is required" }` — пустая/битая запись
- Пустой массив / не массив / больше 1000 → `400`. Весь запрос при дубликатах **не** падает с `409`.
- Размер тела: лимит Express по умолчанию ~100kb слишком мал для пачки; в API стоит `BODY_LIMIT` (дефолт `50mb`, см. `.env-dist`).

**Получить статус / результат**

```http
GET /api/analyze/:jobId
Authorization: Bearer <API_TOKEN>
```

Ответ:

```json
{
  "jobId": 123,
  "status": "pending | running | done | failed",
  "sgf": "...",
  "analyzeResult": { "moves": [ ... ], "meta": { ... } },
  "error": null
}
```

Пока джоб в очереди или выполняется, `analyzeResult` может быть `null`.

### Очередь

1. `POST /api/analyze` (или batch) создаёт запись в `jobs` (`SgfAnalyzeJob`) и строку в `sgf_analyze_results`.
2. Воркер крутится в **отдельном контейнере** `worker` (`yarn worker` / `WorkerModule`), API (`node`) только ставит джобы (`worker: false`).
   - Образ API: лёгкий `docker/node/Dockerfile.api` (без KataGo/CUDA).
   - Образ воркера: `docker/node/Dockerfile` (CUDA + KataGo).
3. Воркер раз в секунду забирает следующий `pending` джоб (`FOR UPDATE SKIP LOCKED`).
4. В одном воркер-процессе одновременно выполняется **не больше одного** джоба (GPU лучше не делить — один `worker`).
5. При ошибке статус → `failed` (ретраев по сути нет: `triesCount = 1`).
Логи воркера: `docker compose logs -f worker` (или `make logs` — `node` + `worker`).

### Что делает воркер

1. Парсит SGF (`@sabaki/sgf`, только главная линия): размер доски, правила, коми, начальные камни, ходы в GTP.
2. Собирает JSON-запрос для KataGo (`moves`, `boardXSize`/`boardYSize`, `rules`, `komi`, `analyzeTurns`, …).
3. Шлёт его в долгоживущий процесс  
   `katago analysis -config … -model …`  
   по протоколу **JSONL** (stdin/stdout).
4. Ждёт ответы по всем `analyzeTurns` (таймаут по умолчанию ~30 мин: `KATAGO_QUERY_TIMEOUT_MS`).
5. Маппит ответ в удобный JSON и пишет в `sgf_analyze_results.analyze_result`.

### Дефолты из SGF / конфига

| Параметр | Если не задано |
|---|---|
| Размер доски | `19×19` |
| Правила | `japanese` |
| Коми | `0` (если в SGF нет `KM`) |
| `analyzeTurns` | стартовая позиция + после каждого хода (`0..N`) |
| `maxVisits` | `500` из `katago/analysis.cfg` |

### Формат `analyzeResult.moves`

Для каждого сыгранного хода:

- `winrate`, `scoreLead` — оценка позиции **после** хода (с точки зрения чёрных, см. `reportAnalysisWinratesAs = BLACK` в конфиге);
- `leader` — `B` / `W` / `even` по `scoreLead`;
- `alternatives` — до 10 альтернатив **до** хода (`coord`, `winrate`, `scoreLead`, `visits`, `prior`, `pv`, …).

Ход 0 (пустая/стартовая позиция) анализируется KataGo, но в массив `moves` не попадает.

### Хранение

Таблица `sgf_analyze_results`: `job_id`, исходный `sgf`, уникальный `sgf_md5`, `analyze_result` (jsonb).

## Сборка

### Production

```bash
make
```

### Сборка для production

В `.env` укажи `COMPOSE_FILE=docker-compose.v2.prod.yml:docker-compose.override.yml` и выполни шаги выше.

### Development

```bash
make dev
```

## Миграции

Создать миграцию:

```bash
yarn knex migrate:make [name]
```

Список миграций:

```bash
yarn knex migrate:list
```

Применить миграцию:

```bash
yarn knex migrate:up
```

Откатить миграцию:

```bash
yarn knex migrate:down
```

## Сиды

Создать сид:

```bash
yarn knex seed:make seed_name
```

```bash
yarn knex seed:run
```

## Команды

Запуск тестовой команды:

```bash
yarn cli -- test:test -t test -sf
```

Вернуть failed-джобы в `pending` (сбрасывает `error`, `attempts`, `started_at`, `finished_at`):

```bash
# все failed
yarn cli -- queue:requeue-failed

# одна джоба
yarn cli -- queue:requeue-failed --job-id 25572
# или коротко:
yarn cli -- queue:requeue-failed -j 25572
```

Локальный запуск storage:

```bash
http-server ./storage --cors=false
```

## SQL

```sql
-- вывести текущую загруженность очереди
select status, count(*)
from jobs
group by status;

-- вывести завершенные джобы
SELECT j.id,
       j.status,
       j.started_at,
       j.finished_at,
       EXTRACT(EPOCH FROM (j.finished_at - j.started_at)) AS duration_sec,
       j.error,
       (s.analyze_result -> 'meta' ->> 'movesCount')::int AS "movesCount"
FROM jobs j
         left join sgf_analyze_results s on j.id = s.job_id
WHERE j.finished_at IS NOT NULL
ORDER BY j.finished_at DESC;

```
