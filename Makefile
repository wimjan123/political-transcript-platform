.PHONY: setup dev start-db start-api start-web deploy import-data clean help start-meili meili-init meili-reindex

# Colors for output
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

help: ## Show this help message
	@echo "Political Transcript Search Platform"
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## One-command setup for development
	@echo "$(GREEN)Setting up Political Transcript Search Platform...$(NC)"
	@if [ ! -f .env ]; then cp .env.example .env && echo "$(YELLOW)Created .env file from template$(NC)"; fi
	@docker compose build
	@docker compose up -d db
	@echo "$(YELLOW)Waiting for database to be ready...$(NC)"
	@sleep 10
	@docker compose run --rm api python -m alembic upgrade head
	@echo "$(GREEN)Setup complete! Run 'make dev' to start development.$(NC)"

dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(NC)"
	@docker compose up --build

start-db: ## Start PostgreSQL database only
	@echo "$(GREEN)Starting PostgreSQL database...$(NC)"
	@docker compose up -d db

start-api: ## Start backend API only
	@echo "$(GREEN)Starting backend API...$(NC)"
	@docker compose up -d db
	@sleep 5
	@docker compose up api

start-web: ## Start frontend only
	@echo "$(GREEN)Starting frontend...$(NC)"
	@docker compose up web

deploy: ## Deploy to production
	@echo "$(GREEN)Deploying to production...$(NC)"
	@docker compose -f docker compose.prod.yml up -d --build
	@echo "$(GREEN)Production deployment complete!$(NC)"

import-data: ## Import HTML data from source directory
	@echo "$(GREEN)Importing HTML transcript data...$(NC)"
	@curl -X POST "http://localhost:8000/api/upload/import-html?force_reimport=false"
	@echo "$(GREEN)Data import started! Check status with: curl http://localhost:8000/api/upload/import-status$(NC)"

test: ## Run tests
	@echo "$(GREEN)Running tests...$(NC)"
	@docker compose run --rm api python -m pytest tests/ -v

lint: ## Run linting
	@echo "$(GREEN)Running linting...$(NC)"
	@docker compose run --rm api python -m black backend/src --check
	@docker compose run --rm api python -m flake8 backend/src

format: ## Format code
	@echo "$(GREEN)Formatting code...$(NC)"
	@docker compose run --rm api python -m black backend/src
	@docker compose run --rm api python -m isort backend/src

clean: ## Clean up containers and volumes
	@echo "$(RED)Cleaning up containers and volumes...$(NC)"
	@docker compose down -v
	@docker system prune -f
	@echo "$(GREEN)Cleanup complete!$(NC)"

logs: ## View logs
	@docker compose logs -f

logs-api: ## View API logs
	@docker compose logs -f api

logs-web: ## View frontend logs
	@docker compose logs -f web

logs-db: ## View database logs
	@docker compose logs -f db

shell-api: ## Open shell in API container
	@docker compose exec api bash

shell-db: ## Open PostgreSQL shell
	@docker compose exec db psql -U postgres -d political_transcripts

backup-db: ## Backup database
	@echo "$(GREEN)Creating database backup...$(NC)"
	@docker compose exec db pg_dump -U postgres political_transcripts > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Meilisearch configuration
MEILI_HOST ?= http://localhost:7700
MEILI_MASTER_KEY ?= change-me

.PHONY: meili-up meili-down meili-init meili-sync

meili-up: ## Start Meilisearch only
	@echo "$(GREEN)Starting Meilisearch...$(NC)"
	@docker compose up -d meilisearch

meili-down: ## Stop Meilisearch service
	@echo "$(YELLOW)Stopping Meilisearch...$(NC)"
	@docker compose stop meilisearch

start-meili: ## Start Meilisearch service
	@echo "$(GREEN)Starting Meilisearch service...$(NC)"
	@docker compose up -d meilisearch

meili-init: ## Initialize Meilisearch indexes and settings
	@echo "$(GREEN)Initializing Meilisearch indexes and settings...$(NC)"
	@docker compose run --rm -e MEILI_HOST=http://political_transcripts_meilisearch:7700 -e MEILI_MASTER_KEY=$(MEILI_MASTER_KEY) api \
		python scripts/meili_init.py

meili-reindex: ## Full reindexing of segments from PostgreSQL to Meilisearch
	@echo "$(GREEN)Reindexing all segments to Meilisearch...$(NC)"
	@docker compose run --rm -e MEILI_HOST=http://political_transcripts_meilisearch:7700 -e MEILI_MASTER_KEY=$(MEILI_MASTER_KEY) api \
		python scripts/meili_reindex.py

meili-sync: ## Incremental sync from Postgres into Meilisearch
	@echo "$(GREEN)Syncing data to Meilisearch...$(NC)"
	@docker compose run --rm -e MEILI_HOST=http://political_transcripts_meilisearch:7700 -e MEILI_MASTER_KEY=$(MEILI_MASTER_KEY) api \
		python scripts/meili_sync.py --incremental --batch-size=1000
	@echo "$(GREEN)Meilisearch sync complete!$(NC)"

# Search Engine Management
.PHONY: search-health search-create-index search-reindex search-test search-compare search-switch

search-health: ## Check health of both search engines
	@echo "$(GREEN)Checking search engine health...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py health

search-create-index: ## Create Elasticsearch index
	@echo "$(GREEN)Creating Elasticsearch index...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py create-index

search-reindex: ## Reindex data to all search engines (usage: make search-reindex ENGINE=all BATCH_SIZE=500)
	@echo "$(GREEN)Reindexing search data...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py reindex --engine=$(or $(ENGINE),all) --batch-size=$(or $(BATCH_SIZE),500)

search-test: ## Test search functionality (usage: make search-test QUERY="test query" ENGINE=elasticsearch)
	@echo "$(GREEN)Testing search...$(NC)"
	$(if $(ENGINE), \
		@docker compose run --rm api python scripts/manage_search.py test "$(QUERY)" --engine=$(ENGINE), \
		@docker compose run --rm api python scripts/manage_search.py test "$(QUERY)")

search-compare: ## Compare search engines (usage: make search-compare QUERY="test query")
	@echo "$(GREEN)Comparing search engines...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py compare "$(QUERY)"

search-switch: ## Switch primary search engine (usage: make search-switch ENGINE=elasticsearch)
	@echo "$(GREEN)Switching primary search engine...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py switch $(ENGINE)

# Elasticsearch specific commands
es-reindex: ## Reindex data to Elasticsearch only
	@echo "$(GREEN)Reindexing to Elasticsearch...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py reindex --engine=elasticsearch

es-test: ## Test Elasticsearch search (usage: make es-test QUERY="test query")
	@echo "$(GREEN)Testing Elasticsearch...$(NC)"
	@docker compose run --rm api python scripts/manage_search.py test "$(QUERY)" --engine=elasticsearch

restore-db: ## Restore database (usage: make restore-db FILE=backup.sql)
	@echo "$(GREEN)Restoring database from $(FILE)...$(NC)"
	@docker compose exec -T db psql -U postgres political_transcripts < $(FILE)
	@echo "$(GREEN)Database restore complete!$(NC)"
