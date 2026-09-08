# LightType — run web (app) + geometry API together.
# Usage: make          or  make start

APP_DIR   := app
API_DIR   := api
APP_PORT  ?= 43127
API_PORT  ?= 8765
APP_HOST  ?= 127.0.0.1
API_HOST  ?= 127.0.0.1
APP_URL   := http://$(APP_HOST):$(APP_PORT)
API_URL   := http://$(API_HOST):$(API_PORT)

PYTHON    ?= python3
NPM       ?= npm
UVICORN   := $(PYTHON) -m uvicorn

COMPOSE   ?= docker compose
COMPOSE_FILE := docker-compose.yml
ROOT_DIR  := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BAMBU_CONNECT_HOST_PATH ?= $(ROOT_DIR)/data/bambu-export

.DEFAULT_GOAL := help

.PHONY: help install install-app install-api dev app api \
	start stop down restart logs build ps \
	build-web lint ensure-bambu-env \
	cap-sync cap-android cap-ios cap-dev mobile

help:
	@echo LightType
	@echo   make start     Build and run with Docker
	@echo   make stop      Stop the containers
	@echo   make restart   Recreate the stack
	@echo   make logs      Follow container logs
	@echo   make build     Build images without starting
	@echo   make ps        Show container status
	@echo   make install   Install Node + Python deps \(local\)
	@echo   make dev       Run app + API locally \(no Docker\)
	@echo   make mobile    Build static + sync Capacitor
	@echo   make cap-android  Open Android Studio
	@echo   make cap-ios      Open Xcode
	@echo
	@echo App: $(APP_URL)
	@echo API: $(API_URL)/api/health
	@echo Bambu export: $(BAMBU_CONNECT_HOST_PATH)

ensure-bambu-env:
	@mkdir -p "$(BAMBU_CONNECT_HOST_PATH)"
	@printf '%s\n' \
		'# Auto-generated for docker compose + Bambu Connect' \
		"BAMBU_CONNECT_HOST_PATH=$(BAMBU_CONNECT_HOST_PATH)" \
		> "$(ROOT_DIR)/.env"

install: install-app install-api

install-app:
	cd $(APP_DIR) && $(NPM) install

install-api:
	cd $(API_DIR) && $(PYTHON) -m pip install -r requirements.txt

dev:
	@echo Starting API on $(API_URL) and app on $(APP_URL)
	@trap 'kill 0' INT TERM EXIT; \
	( cd $(API_DIR) && $(UVICORN) app.main:app --host $(API_HOST) --port $(API_PORT) --reload ) & \
	( cd $(APP_DIR) && API_URL=$(API_URL) $(NPM) run dev ) & \
	wait

app:
	cd $(APP_DIR) && API_URL=$(API_URL) $(NPM) run dev

api:
	cd $(API_DIR) && $(UVICORN) app.main:app --host $(API_HOST) --port $(API_PORT) --reload

build-web:
	cd $(APP_DIR) && API_URL=$(API_URL) $(NPM) run build

lint:
	cd $(APP_DIR) && $(NPM) run lint

start: ensure-bambu-env
	BAMBU_CONNECT_HOST_PATH="$(BAMBU_CONNECT_HOST_PATH)" $(COMPOSE) -f $(COMPOSE_FILE) up --build -d --remove-orphans
	@echo LightType is running at $(APP_URL)
	@echo API health: $(API_URL)/api/health
	@echo Bambu Connect path: $(BAMBU_CONNECT_HOST_PATH)
	@echo Logs: make logs    Stop: make stop

stop down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

restart: ensure-bambu-env
	BAMBU_CONNECT_HOST_PATH="$(BAMBU_CONNECT_HOST_PATH)" $(COMPOSE) -f $(COMPOSE_FILE) down
	BAMBU_CONNECT_HOST_PATH="$(BAMBU_CONNECT_HOST_PATH)" $(COMPOSE) -f $(COMPOSE_FILE) up --build -d --remove-orphans
	@echo Bambu Connect path: $(BAMBU_CONNECT_HOST_PATH)

logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

build:
	$(COMPOSE) -f $(COMPOSE_FILE) build

ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps

# --- Capacitor (mobile) -------------------------------------------------------
# Defina o IP da sua máquina na LAN para o aparelho alcançar a API:
#   make mobile LAN_IP=192.168.0.10
LAN_IP ?= 127.0.0.1
MOBILE_API_URL ?= http://$(LAN_IP):$(API_PORT)/api

mobile:
	cd $(APP_DIR) && CAPACITOR_BUILD=1 NEXT_PUBLIC_API_URL=$(MOBILE_API_URL) $(NPM) run build:mobile
	cd $(APP_DIR) && $(NPM) run cap:sync
	@echo Synced. Open: make cap-android  or  make cap-ios
	@echo API URL baked into the app: $(MOBILE_API_URL)

# Live-reload: WebView aponta para o Next local (rode make dev em outro terminal)
cap-dev:
	@test -n "$(LAN_IP)" || (echo "Use: make cap-dev LAN_IP=192.168.x.x"; exit 1)
	cd $(APP_DIR) && mkdir -p out && echo '<html><body>LightType Capacitor</body></html>' > out/index.html
	cd $(APP_DIR) && CAP_SERVER_URL=http://$(LAN_IP):$(APP_PORT) npx cap sync
	@echo Capacitor apontando para http://$(LAN_IP):$(APP_PORT)
	@echo Rode a API em 0.0.0.0: make api API_HOST=0.0.0.0
	@echo Rode o web: cd app && npm run dev -- --hostname 0.0.0.0

cap-sync:
	cd $(APP_DIR) && $(NPM) run cap:sync

cap-android:
	cd $(APP_DIR) && $(NPM) run cap:android

cap-ios:
	cd $(APP_DIR) && $(NPM) run cap:ios
