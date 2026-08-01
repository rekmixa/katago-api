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
numAnalysisThreads = 8
numSearchThreadsPerAnalysisThread = 2
nnMaxBatchSize = 16
```

Если всё ещё получаешь CUDA OOM — уменьши `nnMaxBatchSize` (например до 8) и/или число потоков.

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

1. `POST /api/analyze` создаёт запись в `jobs` (`SgfAnalyzeJob`) и строку в `sgf_analyze_results`.
2. Воркер раз в секунду забирает следующий `pending` джоб (`FOR UPDATE SKIP LOCKED`).
3. В одном процессе одновременно выполняется **не больше одного** джоба.
4. При ошибке статус → `failed` (ретраев по сути нет: `triesCount = 1`).

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

Локальный запуск storage:

```bash
http-server ./storage --cors=false
```
