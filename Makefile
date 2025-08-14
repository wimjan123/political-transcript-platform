.PHONY: setup dev start-db start-api start-web deploy import-data clean help

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
	@echo "$(GREEN)Database backup complete!$(NC)"

restore-db: ## Restore database (usage: make restore-db FILE=backup.sql)
	@echo "$(GREEN)Restoring database from $(FILE)...$(NC)"
	@docker compose exec -T db psql -U postgres political_transcripts < $(FILE)
	@echo "$(GREEN)Database restore complete!$(NC)"