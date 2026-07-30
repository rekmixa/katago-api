all: git-pull up migrate logs

dev: up logs

git-pull:
	@git pull

env:
	@docker-compose run --rm node bash

up:
	@docker-compose up -d --remove-orphans --force-recreate --build

down:
	@docker-compoes down

down-v:
	@docker-compose down -v

stop:
	@docker-compose stop

restart:
	@docker-compose restart

logs:
	@docker-compose logs -f --tail=1000 node

cp-env:
	@test -f .env || cp .env-dist .env

docker-compose-override:
	@test -f docker-compose.override.yml || echo "version: '3'" >> docker-compose.override.yml

mkdir-data:
	@test -d data || mkdir data

install: cp-env mkdir-data docker-compose-override up

migrate:
	@docker-compose exec node yarn knex migrate:up

seed:
	@docker-compose exec node yarn knex seed:run

rm-git:
	@rm -rf .git

rm-node-modules:
	@rm -rf node_modules
