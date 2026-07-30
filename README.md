# katago-api

> Nest TS
> Knex
> nest-commander

## Installation

```bash
make cp-env
```

##### After you must configure your app in .env file

```bash
make install
make migrate
make seed
```

View docker container logs

```bash
make logs
```

## Build Setup

### Production

```bash
make
```

### Building for production

To building for production you need to change `COMPOSE_FILE` param in _.env_ to _docker-compose.prod.yml_ and follow the above steps

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
