# katago-api

> Nest TS
> Knex
> nest-commander

## Installation

```bash
make cp-env
```

##### After you must configure your app in .env file

For production with Traefik v2, set in `.env`:

```bash
COMPOSE_FILE=docker-compose.v2.prod.yml:docker-compose.override.yml
```

```bash
make install
make migrate
make seed
```

View docker container logs

```bash
make logs
```

## GPU (NVIDIA) on a new server

First make sure the NVIDIA driver works on the host:

```bash
nvidia-smi
lspci | grep -i nvidia
```

If `nvidia-smi` works but Docker fails with  
`could not select device driver "nvidia" with capabilities: [[gpu]]`, install the NVIDIA Container Toolkit:

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

Verify GPU access inside Docker:

```bash
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

Then start the project:

```bash
docker-compose build --no-cache node
docker-compose up -d
```

`katago/analysis.cfg` is tuned for NVIDIA L40S-4Q (4 GB VRAM):

```
numAnalysisThreads = 4
numSearchThreadsPerAnalysisThread = 4
nnMaxBatchSize = 8
```

If you still hit CUDA OOM, lower `nnMaxBatchSize` (e.g. to 4) and/or the thread counts.

## Build Setup

### Production

```bash
make
```

### Building for production

Set `COMPOSE_FILE=docker-compose.v2.prod.yml:docker-compose.override.yml` in `.env` and follow the steps above.

### Development

```bash
make dev
```

## Migrations

Create migration:

```bash
yarn knex migrate:make [name]
```

Migrations list:

```bash
yarn knex migrate:list
```

Up migration:

```bash
yarn knex migrate:up
```

Down migration:

```bash
yarn knex migrate:down
```

## Seeds

Create seed:

```bash
yarn knex seed:make seed_name
```

```bash
yarn knex seed:run
```

## Commands

Running test command:

```bash
yarn cli -- test:test -t test -sf
```

Launch storage in local:

```bash
http-server ./storage --cors=false
```
