# Contributing

Thanks for contributing to the Political Transcript Platform! This guide covers workflow, code style, naming, testing, and PR expectations.

## Workflow
- Create a topic branch: `git checkout -b <scope>/<short-description>`
- Make focused changes with tests
- Run quality checks: `make lint && make test`
- Push and open a PR with clear description and test steps

## Code Style & Naming Conventions
- Python
  - 4‑space indent; format with Black (`make format`)
  - Import order via isort (`make format`); lint with Flake8 (`make lint`)
  - Module/file names: `snake_case.py`
  - API routes under `backend/src/routes`; services in `backend/src/services`
- React + TypeScript
  - Functional components and hooks
  - Components `PascalCase.tsx`; pages end with `*Page.tsx`
  - Use ESLint (via CRA). Run `cd frontend && npm test` for UI tests

## Testing Guidelines
- Backend: pytest
  - Location: `backend/tests`
  - Naming: `test_*.py`
  - Run: `make test`
- Frontend: React Testing Library/Jest
  - Location: alongside files or under `frontend/src/__tests__`
  - Naming: `*.test.tsx`
  - Run: `cd frontend && npm test`

## Commits & Pull Requests
- Commits
  - Imperative mood, concise subject; optional scope prefix
  - Examples: `backend: add search filters`, `frontend: fix summary card layout`
- Pull Requests
  - Clear description and linked issues
  - Screenshots/gifs for UI changes
  - Steps to test (commands, env vars)
  - Call out any migrations or `.env` changes
  - Keep changes atomic and focused

## Build, Test, and Development Commands
- Common
  - `make setup` – Build images, start DB, run migrations
  - `make dev` – Run full stack (db, api, web)
  - `make start-api` / `make start-web` – Start single service
  - `make test` – Backend tests
  - `make lint` / `make format` – Backend lint/format
  - Data import: `make import-data` (triggers `/api/upload/import-html`)
- Frontend
  - `cd frontend && npm start` – Dev server with proxy
  - `cd frontend && npm run build` – Production bundle
  - `cd frontend && npm test` – UI tests

## Security & Configuration
- Configure via `.env` (copy from `.env.example`); API listens on `:8000`, frontend proxies to it
- Never commit secrets; prefer Docker secrets or environment variables
- Validate and sanitize uploads; for large imports use `make import-data`
- Monitor progress with `make logs-api` and `make logs-web`

## Project Structure
- Root: Docker Compose, `Makefile`, `.env`/`.env.example`
- Backend: `backend/src` (routes, models, services), migrations, scripts
- Frontend: `frontend/src` (pages, components, services), `public`
- Data: raw HTML under `data/html`; app-created data under `/data` in containers

---
Please update docs and tests relevant to your changes, and keep PRs scoped and reviewable. Thank you!
