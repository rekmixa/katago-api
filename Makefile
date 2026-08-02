ifneq (,$(wildcard .env))
include .env
export
endif

all: git-pull up migrate logs

dev: up logs

git-pull:
	@git pull

env:
	@docker compose run --rm node bash

up:
	@docker compose up -d --remove-orphans --force-recreate --build

down:
	@docker compose down

down-v:
	@docker compose down -v

stop:
	@docker compose stop

restart:
	@docker compose restart

logs:
	@docker compose logs -f --tail=1000 node worker telegram

logs-node:
	@docker compose logs -f --tail=1000 node

logs-worker:
	@docker compose logs -f worker

logs-telegram:
	@docker compose logs -f telegram

recreate-worker:
	@docker compose up -d --force-recreate worker

cp-env:
	@test -f .env || cp .env-dist .env

mkdir-data:
	@test -d data || mkdir data

install: cp-env mkdir-data up

migrate:
	@docker compose exec node yarn knex migrate:up

seed:
	@docker compose exec node yarn knex seed:run

db-dump:
	@mkdir -p db-backups
	@docker compose exec -T db pg_dump -U "$(DB_USER)" -d "$(DB_NAME)" > "db-backups/dump_$$(date +%Y%m%d_%H%M%S).sql"
	@ls -lah db-backups/dump_*.sql | tail -n 1

rm-git:
	@rm -rf .git

rm-node-modules:
	@rm -rf node_modules
