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
numAnalysisThreads = 4
numSearchThreadsPerAnalysisThread = 4
nnMaxBatchSize = 8
```

Если всё ещё получаешь CUDA OOM — уменьши `nnMaxBatchSize` (например до 4) и/или число потоков.

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
