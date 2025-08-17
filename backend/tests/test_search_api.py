import os
import types
import asyncio

from fastapi.testclient import TestClient


# Ensure a lightweight, in-memory DB is used during tests
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


def _patch_startup_for_tests():
    # Import here after env vars are set so settings pick them up
    from backend.src import main as main_module
    from backend.src.database import Base, engine

    # Replace init_db with a no-op table creation for SQLite to avoid PG-specific SQL
    async def _init_db_sqlite_only():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    main_module.init_db = _init_db_sqlite_only  # type: ignore[attr-defined]
    return main_module


def test_search_endpoint_returns_200_with_empty_results():
    main_module = _patch_startup_for_tests()
    client = TestClient(main_module.app)

    # Use exact search_type to avoid PG fulltext functions on SQLite
    response = client.get("/api/search/?q=test&search_type=exact")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)


def test_meili_instant_endpoint_returns_200_with_mocked_hits(monkeypatch):
    main_module = _patch_startup_for_tests()

    # Monkeypatch the Meilisearch HTTP call to avoid network dependency
    from backend.src.routes import meilisearch_search as meili_module

    class _FakeResponse:
        def __init__(self):
            self.status_code = 200

        def json(self):
            return {
                "hits": [
                    {
                        "id": "seg_1",
                        "text": "example text",
                        "speaker": "Speaker A",
                        "video_seconds": 10,
                        "_formatted": {"text": "example text"},
                    }
                ],
                "estimatedTotalHits": 1,
                "processingTimeMs": 5,
            }

    async def _fake_meili_request(method, path, json_body=None, params=None):
        return _FakeResponse()

    monkeypatch.setattr(meili_module, "meili_request", _fake_meili_request)

    client = TestClient(main_module.app)
    response = client.get("/api/search/instant?q=test")
    assert response.status_code == 200
    data = response.json()
    assert "hits" in data
    assert isinstance(data["hits"], list)

