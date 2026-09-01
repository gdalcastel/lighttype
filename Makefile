# Default to the Compose V2 plugin. Override if needed: make start COMPOSE=docker-compose
COMPOSE ?= docker compose
APP_URL ?= http://127.0.0.1:43127

.DEFAULT_GOAL := help

.PHONY: help start stop restart logs build ps down

help:
	@echo LightType
	@echo   make start     Build and run the app with Docker
	@echo   make stop      Stop the containers
	@echo   make restart   Recreate the stack
	@echo   make logs      Follow container logs
	@echo   make build     Build images without starting
	@echo   make ps        Show container status
	@echo App URL: $(APP_URL)

start:
	$(COMPOSE) up --build -d --remove-orphans
	@echo LightType is running at $(APP_URL)
	@echo API health: http://127.0.0.1:8765/api/health
	@echo Logs: make logs    Stop: make stop

stop down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(COMPOSE) up --build -d --remove-orphans

logs:
	$(COMPOSE) logs -f

build:
	$(COMPOSE) build

ps:
	$(COMPOSE) ps
