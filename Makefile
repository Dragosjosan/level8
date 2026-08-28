.PHONY: help build-dev build-prod run-dev run-prod deploy-prod restart-dev restart-prod down-dev down-prod logs-prod build run down debug

.DEFAULT_GOAL := help

COMPOSE := docker compose -f docker-compose.yml

help:
	@echo "Development:"
	@echo "  make build-dev    - Build dev containers (alias: make build)"
	@echo "  make run-dev      - Start dev containers (alias: make run)"
	@echo "  make restart-dev  - Restart dev containers"
	@echo "  make down-dev     - Stop dev containers (alias: make down)"
	@echo ""
	@echo "Production:"
	@echo "  make build-prod   - Build prod containers"
	@echo "  make run-prod     - Start prod containers"
	@echo "  make deploy-prod  - Build and deploy prod containers"
	@echo "  make restart-prod - Restart prod containers"
	@echo "  make down-prod    - Stop prod containers"
	@echo "  make logs-prod    - Follow prod container logs"

build-dev:
	$(COMPOSE) build

build-prod:
	$(COMPOSE) build

debug-dev:
	docker logs -f factor8-backend

run-dev:
	$(COMPOSE) up -d

run-prod:
	$(COMPOSE) up -d --remove-orphans

deploy-prod:
	$(COMPOSE) up -d --build --remove-orphans

restart-dev:
	$(COMPOSE) restart

restart-prod:
	$(COMPOSE) restart

down-dev:
	$(COMPOSE) down

down-prod:
	$(COMPOSE) down

logs-prod:
	$(COMPOSE) logs --tail=100 -f

build: build-dev

run: run-dev

down: down-dev

debug: debug-dev
