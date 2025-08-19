#!/usr/bin/env sh
set -e

# Simple launcher to run Uvicorn with configurable workers
# Env vars:
# - API_HOST (default 0.0.0.0)
# - API_PORT (default 8000)
# - API_WORKERS (default 1)

HOST="${API_HOST:-0.0.0.0}"
PORT="${API_PORT:-8000}"
WORKERS="${API_WORKERS:-6}"

exec uvicorn src.main:app --host "$HOST" --port "$PORT" --workers "$WORKERS"
