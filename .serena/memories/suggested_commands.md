# Essential Commands for Political Transcript Platform Development

**IMPORTANT**: All commands must be run from the `political-transcript-platform/` directory.

## Development Setup & Workflow
```bash
cd political-transcript-platform/  # Always start here first
make setup          # Initial setup with database creation
make dev            # Start all services (db, api, web, meilisearch)
make import-data    # Import HTML transcripts from data source
```

## Individual Services
```bash
make start-db       # PostgreSQL only (port 5433)
make start-api      # Backend API only (port 8000, requires DB)
make start-web      # Frontend only (port 3000)
make start-meili    # Meilisearch only (port 7700)
```

## Testing & Quality Assurance
```bash
# Backend
make test           # Run backend tests with pytest
make lint           # Check Python code formatting (black, flake8)
make format         # Auto-format Python code (black, isort)
pytest tests/specific_test.py  # Run individual test file

# Frontend
cd frontend && npm test        # Run React tests with Jest
cd frontend && npm run test:e2e    # Run Playwright E2E tests
cd frontend && npm run lint        # ESLint checking
cd frontend && npm run lint:fix    # Auto-fix ESLint issues
```

## Data Operations
```bash
# Import Operations
make import-data    # Import HTML transcripts
curl -X POST "http://localhost:8000/api/upload/import-vlos-xml"  # Import XML
curl "http://localhost:8000/api/upload/import-status"  # Check status
curl -X POST "http://localhost:8000/api/upload/import-cancel"  # Cancel import

# Meilisearch Operations
make meili-init     # Initialize Meilisearch indexes
make meili-sync     # Sync data to Meilisearch
make meili-reindex  # Full reindexing from PostgreSQL
```

## Database Operations
```bash
make shell-db       # PostgreSQL shell access
make backup-db      # Create timestamped database backup
make restore-db FILE=backup.sql  # Restore from backup
```

## Monitoring & Debugging
```bash
make logs           # View all logs
make logs-api       # View API logs only
make logs-web       # View frontend logs only
make logs-db        # View database logs only
make shell-api      # Open shell in API container
```

## Service URLs (Development)
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 (API docs at /docs)
- Database: localhost:5433 (PostgreSQL)
- Meilisearch: http://localhost:7700