# Development Guide

This guide summarizes the day‑to‑day developer workflow, environment setup, and core commands.

## Prerequisites
- Docker + Docker Compose (recommended workflow)
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

## First‑time Setup (Docker)
```bash
cp .env.example .env    # Configure as needed
make setup              # Build images, start DB, run migrations
```

## Run the Stack (Dev)
```bash
make dev                # Start db, api, web

# or individually
make start-db
make start-api
make start-web
```

Services expose:
- Frontend: http://localhost:3000
- API: http://localhost:8000 (docs at /docs)

## Data Import
- Place raw HTML transcripts in `data/html`
- Start import: `make import-data` (calls `/api/upload/import-html`)
- Monitor progress: `make logs-api`

Tweede Kamer VLOS XML import:
```bash
curl -X POST "http://localhost:8000/api/upload/import-vlos-xml"
curl "http://localhost:8000/api/upload/import-status"
```

## Backend (FastAPI)
- Tests: `make test`
- Lint: `make lint` (Black check + Flake8)
- Format: `make format` (Black + isort)
- Alembic migrations run during `make setup`. Manual run:
  ```bash
  docker compose run --rm api python -m alembic upgrade head
  ```
- API docs: `http://localhost:8000/docs`

## Frontend (React + TypeScript)
```bash
cd frontend
npm start        # CRA dev server with proxy to API
npm test         # Jest + React Testing Library
npm run build    # Production build
```

Proxy: `frontend/src/setupProxy.js` forwards `/api` to the API container during dev.

## Meilisearch
```bash
make start-meili  # Start Meilisearch
make meili-init   # Initialize indexes
make meili-sync   # Incremental sync from Postgres
```

## Logs & Troubleshooting
- API logs: `make logs-api`
- Web logs: `make logs-web`
- DB logs: `make logs-db`

If Meilisearch issues:
```bash
curl http://localhost:7700/health
make meili-init
```

## Conventions
- Python: 4‑space indent, Black, isort, Flake8
- TS/React: functional components, hooks, ESLint
- Names: Python `snake_case.py`; React components `PascalCase.tsx`; pages end with `*Page.tsx`

For detailed contribution and PR guidelines, see `CONTRIBUTING.md`.
