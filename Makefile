.PHONY: help build-dev build-prod run-dev run-prod restart-dev restart-prod down-dev down-prod build down dev 

.DEFAULT_GOAL := help

help:
	@echo "Development:"
	@echo "  make build-dev    - Build dev containers (alias: make build)"
	@echo "  make run-dev      - Start dev containers (alias: make dev)"
	@echo "  make restart-dev  - Restart dev containers"
	@echo "  make down-dev     - Stop dev containers (alias: make dev)"
	@echo ""
	@echo "Production:"
	@echo "  make build-prod   - Build prod containers"
	@echo "  make run-prod     - Start prod containers"
	@echo "  make restart-prod - Restart prod containers"
	@echo "  make down-prod    - Stop prod containers"

build-dev:
	docker compose build

build-prod:
	docker compose -f docker-compose.prod.yml build

debug-dev:
	docker logs -f factor8-backend

run-dev:
	docker compose up -d

run-prod:
	docker compose -f docker-compose.prod.yml up -d

restart-dev:
	docker compose restart

restart-prod:
	docker compose -f docker-compose.prod.yml restart

down-dev:
	docker compose -f docker-compose.yml down

down-prod:
	docker compose -f docker-compose.prod.yml down

build: build-dev

run: run-dev

down: down-dev

debug: debug-dev
