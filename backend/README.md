# Backend (FastAPI)

FastAPI service that indexes, searches, summarizes, and analyzes political video transcripts. Uses PostgreSQL and Meilisearch.

## Structure
```
backend/
├─ src/
│  ├─ routes/                # API endpoints (search, videos, analytics, upload, etc.)
│  ├─ services/              # Business logic (import, summarization, search)
│  ├─ parsers/               # HTML/XML parsing and helpers
│  ├─ models.py              # SQLAlchemy models
│  ├─ schemas.py             # Pydantic schemas
│  ├─ database.py            # DB session and setup
│  └─ main.py                # FastAPI app entry
├─ scripts/                  # Meilisearch init/sync
├─ migrations/               # Alembic migrations (triggered from Makefile)
└─ requirements.txt
```

## Run (Docker recommended)
- Start stack: `make dev` (from repo root)
- API: `http://localhost:8000` (docs at `/docs`)

## Local development (optional)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## Commands
- Tests: `make test`
- Lint: `make lint`
- Format: `make format`
- Migrations: run during `make setup`; manual: `docker compose run --rm api python -m alembic upgrade head`
- Meilisearch init/sync:
  ```bash
  make start-meili
  make meili-init
  make meili-sync
  ```

## Conventions
- Python: 4‑space indent, Black + isort, Flake8
- Files: `snake_case.py`
- API routes live in `src/routes`; business logic in `src/services`
- Tests in `backend/tests`, named `test_*.py`

## Data
- Raw HTML input under `data/html` (host)
- XML import (Tweede Kamer): `POST /api/upload/import-vlos-xml` (reads from `XML_DATA_DIR`)

## Environment
- Configure `.env` at repo root (copy from `.env.example`)
- Key vars: DB URL, Meilisearch host/key, OpenAI/OpenRouter keys (optional)

## Security
- Never commit secrets. See `SECURITY.md` for hardening & incident response
