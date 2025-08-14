# Repository Guidelines

## Project Structure & Module Organization
- Root: Docker Compose, `Makefile`, `.env`/`.env.example`.
- Backend (FastAPI, Python): `backend/src` (routers, models, services), migrations, scripts.
- Frontend (React + TS): `frontend/src` (pages, components, services), `public` assets.
- Data: `data/html` (raw), app-created folders under `/data` in containers.

## Build, Test, and Development Commands
- `make setup`: Build images, start DB, run Alembic migrations.
- `make dev`: Run full stack via Docker Compose (db, api, web).
- `make start-api` / `make start-web`: Start only backend or frontend services.
- Backend tests: `make test` (pytest in container).
- Backend lint/format: `make lint` and `make format`.
- Frontend: `cd frontend && npm start` for local dev, `npm run build` to bundle, `npm test` for UI tests.
- Data import: `make import-data` triggers `/api/upload/import-html`.

## Coding Style & Naming Conventions
- Python: 4-space indent, Black defaults; import order via isort; lint with Flake8.
- React/TS: Use TypeScript, functional components, hooks; ESLint via CRA.
- Filenames: Python modules `snake_case.py`; React components `PascalCase.tsx`; pages end with `*Page.tsx`.
- API routes under `backend/src/routes`; services in `backend/src/services`.

## Testing Guidelines
- Backend: pytest; place tests under `backend/tests`; name `test_*.py`.
- Frontend: React Testing Library/Jest; place tests alongside files or under `src/__tests__`; name `*.test.tsx`.
- Aim to cover core routes, parsing, and UI flows; include edge cases for search and upload.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject; optional scope prefix (`backend:`, `frontend:`), e.g., `backend: add search filters`.
- PRs: clear description, linked issues, screenshots for UI changes, steps to test, and any migration or .env updates.
- Keep changes atomic; add or update docs/tests relevant to the change.

## Security & Configuration Tips
- Configure via `.env` (copied from `.env.example`); API listens on `:8000`, frontend proxies to it.
- Never commit secrets; prefer Docker secrets or env vars.
- Validate and sanitize uploads; large imports should use `make import-data` and monitor with `make logs-api`.

