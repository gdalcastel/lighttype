COMPOSE ?= $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
APP_URL ?= http://127.0.0.1:43127

.DEFAULT_GOAL := help

.PHONY: help start stop restart logs build ps down

help:
	@echo "LightType"
	@echo ""
	@echo "  make start     Build and run the app with Docker"
	@echo "  make stop      Stop the containers"
	@echo "  make restart   Recreate the stack"
	@echo "  make logs      Follow container logs"
	@echo "  make build     Build images without starting"
	@echo "  make ps        Show container status"
	@echo ""
	@echo "App URL: $(APP_URL)"

start:
	@command -v docker >/dev/null 2>&1 || { echo "Docker is required to run LightType. Install Docker Desktop or the Docker engine."; exit 1; }
	$(COMPOSE) up --build -d --remove-orphans
	@echo ""
	@echo "LightType is running at $(APP_URL)"
	@echo "API health: http://127.0.0.1:8765/api/health"
	@echo ""
	@echo "Logs: make logs    Stop: make stop"

stop down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(MAKE) start

logs:
	$(COMPOSE) logs -f

build:
	$(COMPOSE) build

ps:
	$(COMPOSE) ps
