# Repository Guidelines

## Project Structure & Module Organization
- Root: `docker-compose.yml`, `Makefile`, `.env`/`.env.example`, docs.
- Backend (FastAPI): `backend/src` (routes, services, models, parsers), `migrations/`, `scripts/`.
- Frontend (React + TS): `frontend/src` (pages, components, services, hooks, types), `public/`.
- Data: raw HTML in `data/html`; containers may write under `/data` internally.
- Tests: backend in `backend/tests`; frontend alongside files or `frontend/src/__tests__`.

## Build, Test, and Development Commands
- `make setup`: Build images, start DB, run Alembic migrations.
- `make dev`: Start full stack (db, api, web) with Docker Compose.
- `make start-api` / `make start-web`: Run only backend or frontend.
- Backend quality: `make test` (pytest), `make lint` (Black check + Flake8), `make format` (Black + isort).
- Frontend: `cd frontend && npm start` (dev server), `npm test` (Jest), `npm run build` (prod bundle).
- Import data: `make import-data` (calls `/api/upload/import-html`).

## Coding Style & Naming Conventions
- Python: 4-space indent; format with Black; isort for imports; Flake8 for linting.
- React/TS: functional components and hooks; ESLint via CRA.
- Filenames: Python `snake_case.py`; React components `PascalCase.tsx`; pages end with `*Page.tsx`.
- Layout: API routes in `backend/src/routes`; business logic in `backend/src/services`.

## Testing Guidelines
- Backend: pytest under `backend/tests` with `test_*.py`; cover routes, parsing, and services.
- Frontend: React Testing Library/Jest; tests near code or in `src/__tests__` (`*.test.tsx`).
- Include edge cases for search, upload, and summarization flows.

## Commit & Pull Request Guidelines
- Commits: imperative mood with optional scope, e.g., `backend: add search filters`, `frontend: fix SummaryPage layout`.
- PRs: clear description, linked issues, test steps, screenshots for UI, and note any migrations or `.env` changes.
- Keep changes atomic; update related docs/tests.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; API on `:8000`, frontend proxies to it.
- Never commit secrets; use env vars/Docker secrets.
- Validate uploads; prefer `make import-data` for bulk imports; use `make logs-api` to monitor.
