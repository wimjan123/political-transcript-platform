"""
Meilisearch ETL sync from Postgres

Usage:
  python scripts/meili_sync.py --init
  python scripts/meili_sync.py --incremental --batch-size=1000
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

import sys
from pathlib import Path as _Path
# Ensure project root is on sys.path when running as a script
sys.path.append(str(_Path(__file__).resolve().parents[1]))

from src.config import settings


STATE_FILE = Path(__file__).parent / ".meili_sync_state.json"


def _meili_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if settings.MEILI_MASTER_KEY:
        headers["Authorization"] = f"Bearer {settings.MEILI_MASTER_KEY}"
    return headers


async def meili_request(method: str, path: str, json_body: Any | None = None, params: Dict[str, Any] | None = None) -> httpx.Response:
    url = f"{settings.MEILI_HOST.rstrip('/')}{path}"
    timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, url, headers=_meili_headers(), json=json_body, params=params)
        return resp


def ensure_indexes() -> None:
    async def _run():
        # Create indexes if not exist
        for uid in ("events", "segments"):
            r = await meili_request("GET", f"/indexes/{uid}")
            if r.status_code == 404:
                await meili_request("POST", "/indexes", json_body={"uid": uid, "primaryKey": "id"})

        # Apply settings
        events_settings = {
            "searchableAttributes": ["record_title", "candidate", "topics.topic"],
            "filterableAttributes": [
                "date","format","source","candidate","place.city","place.state","place.country","record_type",
                "topics.score",
                "moderation.hate.flag","moderation.hate.score","moderation.harassment.flag","moderation.harassment.score",
                "moderation.violence.flag","moderation.violence.score","moderation.sexual.flag","moderation.sexual.score",
                "moderation.selfharm.flag","moderation.selfharm.score",
                "stresslens.score","stresslens.rank",
                "document.speaking_time_s","document.sentence_count","document.word_count","document.duration_s",
                "document.sentiment.lmd","document.sentiment.harvard","document.sentiment.vader",
            ],
        }
        segments_settings = {
            "searchableAttributes": ["text", "record_title", "candidate", "topics.topic"],
            "filterableAttributes": events_settings["filterableAttributes"],
        }

        await meili_request("PATCH", "/indexes/events/settings", json_body=events_settings)
        await meili_request("PATCH", "/indexes/segments/settings", json_body=segments_settings)

    asyncio.run(_run())


def load_state() -> Dict[str, Any]:
    if not STATE_FILE.exists():
        return {"events": None, "segments": None}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"events": None, "segments": None}


def save_state(state: Dict[str, Any]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))


def make_engine() -> Engine:
    # Ensure sync driver
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql://", "postgresql+psycopg2://")
    return create_engine(url, pool_pre_ping=True)


def fetch_events_batch(db: Session, updated_after: Optional[datetime], limit: int, offset: int) -> List[Dict[str, Any]]:
    cond = ""
    params: Dict[str, Any] = {}
    if updated_after is not None:
        cond = "WHERE v.updated_at > :updated_after"
        params["updated_after"] = updated_after

    base_sql = f"""
        SELECT v.id, v.title AS record_title, v.date, v.format, v.source, v.candidate, v.place, v.record_type,
               v.filename, v.url, v.video_url, v.vimeo_video_id, v.vimeo_embed_url,
               v.duration AS duration_s, v.total_words, v.total_segments, v.created_at, v.updated_at
        FROM videos v
        {cond}
        ORDER BY v.id
        LIMIT :limit OFFSET :offset
    """
    params.update({"limit": limit, "offset": offset})
    rows = db.execute(text(base_sql), params).mappings().all()

    if not rows:
        return []

    video_ids = [r["id"] for r in rows]

    # Aggregate topics per video
    topics_sql = text(
        """
        SELECT s.video_id, t.name AS topic, AVG(st.score) AS score
        FROM transcript_segments s
        JOIN segment_topics st ON st.segment_id = s.id
        JOIN topics t ON t.id = st.topic_id
        WHERE s.video_id = ANY(:ids)
        GROUP BY s.video_id, t.name
        """
    )
    topic_rows = db.execute(topics_sql, {"ids": video_ids}).mappings().all()
    topics_by_vid: Dict[int, List[Tuple[str, float]]] = {}
    for tr in topic_rows:
        topics_by_vid.setdefault(tr["video_id"], []).append((tr["topic"], float(tr["score"])) )

    # Moderation summary
    mod_sql = text(
        """
        SELECT video_id,
               MAX(CASE WHEN moderation_harassment_flag THEN 1 ELSE 0 END)::bool AS harass_flag,
               MAX(moderation_harassment) AS harass_score,
               MAX(CASE WHEN moderation_hate_flag THEN 1 ELSE 0 END)::bool AS hate_flag,
               MAX(moderation_hate) AS hate_score,
               MAX(CASE WHEN moderation_violence_flag THEN 1 ELSE 0 END)::bool AS violence_flag,
               MAX(moderation_violence) AS violence_score,
               MAX(CASE WHEN moderation_sexual_flag THEN 1 ELSE 0 END)::bool AS sexual_flag,
               MAX(moderation_sexual) AS sexual_score,
               MAX(CASE WHEN moderation_selfharm_flag THEN 1 ELSE 0 END)::bool AS selfharm_flag,
               MAX(moderation_self_harm) AS selfharm_score
        FROM transcript_segments
        WHERE video_id = ANY(:ids)
        GROUP BY video_id
        """
    )
    mod_rows = db.execute(mod_sql, {"ids": video_ids}).mappings().all()
    mod_by_vid = {m["video_id"]: m for m in mod_rows}

    # Stresslens and sentiment summary
    stats_sql = text(
        """
        SELECT video_id,
               AVG(stresslens_score) AS stress_avg,
               MIN(stresslens_rank) AS stress_rank,
               AVG(sentiment_loughran_score) AS lmd,
               AVG(sentiment_harvard_score) AS harvard,
               AVG(sentiment_vader_score) AS vader,
               SUM(word_count) AS word_count
        FROM transcript_segments
        WHERE video_id = ANY(:ids)
        GROUP BY video_id
        """
    )
    stat_rows = db.execute(stats_sql, {"ids": video_ids}).mappings().all()
    stats_by_vid = {s["video_id"]: s for s in stat_rows}

    docs: List[Dict[str, Any]] = []
    for r in rows:
        vid = r["id"]
        tlist = [
            {"topic": t, "score": s}
            for t, s in sorted(topics_by_vid.get(vid, []), key=lambda x: x[1], reverse=True)[:5]
        ]
        mod = mod_by_vid.get(vid, {})
        stats = stats_by_vid.get(vid, {})

        place_city = None
        place_state = None
        place_country = None
        if r["place"]:
            parts = [p.strip() for p in str(r["place"]).split(",")]
            if len(parts) > 0:
                place_city = parts[0] or None
            if len(parts) > 1:
                place_state = parts[1] or None
            if len(parts) > 2:
                place_country = parts[2] or None

        doc = {
            "id": vid,
            "doc_type": "event",
            "record_title": r["record_title"],
            "date": r["date"].date().isoformat() if r["date"] else None,
            "format": r["format"],
            "source": r["source"],
            "candidate": r["candidate"],
            "place": {"city": place_city, "state": place_state, "country": place_country},
            "record_type": r["record_type"],
            "filename": r["filename"],
            "url": r["url"],
            "video_url": r["video_url"],
            "vimeo_video_id": r["vimeo_video_id"],
            "vimeo_embed_url": r["vimeo_embed_url"],
            "topics": tlist,
            "moderation": {
                "harassment": {"flag": mod.get("harass_flag"), "score": mod.get("harass_score")},
                "hate": {"flag": mod.get("hate_flag"), "score": mod.get("hate_score")},
                "violence": {"flag": mod.get("violence_flag"), "score": mod.get("violence_score")},
                "sexual": {"flag": mod.get("sexual_flag"), "score": mod.get("sexual_score")},
                "selfharm": {"flag": mod.get("selfharm_flag"), "score": mod.get("selfharm_score")},
            },
            "stresslens": {"score": stats.get("stress_avg"), "rank": stats.get("stress_rank")},
            "document": {
                "speaking_time_s": None,
                "sentence_count": None,
                "word_count": int(stats.get("word_count") or (r["total_words"] or 0) or 0),
                "duration_s": r["duration_s"],
                "sentiment": {
                    "lmd": stats.get("lmd"),
                    "harvard": stats.get("harvard"),
                    "vader": stats.get("vader"),
                },
            },
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        docs.append(doc)

    return docs


def fetch_segments_batch(db: Session, updated_after: Optional[datetime], limit: int, offset: int) -> List[Dict[str, Any]]:
    cond = []
    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    if updated_after is not None:
        cond.append("s.updated_at > :updated_after")
        params["updated_after"] = updated_after

    where_clause = ("WHERE " + " AND ".join(cond)) if cond else ""

    sql = f"""
        SELECT s.id, s.segment_id, s.speaker_name, s.transcript_text AS text, s.video_seconds AS start_seconds,
               s.duration_seconds, s.word_count, s.char_count, s.timestamp_start, s.timestamp_end,
               s.sentiment_loughran_score, s.sentiment_harvard_score, s.sentiment_vader_score,
               s.moderation_harassment_flag, s.moderation_hate_flag, s.moderation_violence_flag,
               s.moderation_sexual_flag, s.moderation_selfharm_flag,
               s.moderation_harassment, s.moderation_hate, s.moderation_violence, s.moderation_sexual, s.moderation_self_harm,
               s.stresslens_score, s.stresslens_rank,
               s.created_at, s.updated_at,
               v.id AS video_id, v.title AS record_title, v.date, v.format, v.source, v.candidate, v.place, v.record_type
        FROM transcript_segments s
        JOIN videos v ON v.id = s.video_id
        {where_clause}
        ORDER BY s.id
        LIMIT :limit OFFSET :offset
    """
    rows = db.execute(text(sql), params).mappings().all()

    docs: List[Dict[str, Any]] = []
    for r in rows:
        place_city = place_state = place_country = None
        if r["place"]:
            parts = [p.strip() for p in str(r["place"]).split(",")]
            if len(parts) > 0:
                place_city = parts[0] or None
            if len(parts) > 1:
                place_state = parts[1] or None
            if len(parts) > 2:
                place_country = parts[2] or None

        dur = int(r["duration_seconds"]) if r["duration_seconds"] is not None else None
        start = int(r["start_seconds"]) if r["start_seconds"] is not None else None
        end = (start + dur) if (start is not None and dur is not None) else None

        doc = {
            "id": int(r["id"]),
            "doc_type": "segment",
            "segment_id": r["segment_id"],
            "text": r["text"],
            "speaker": r["speaker_name"],
            "start_seconds": start,
            "end_seconds": end,
            "word_count": int(r["word_count"] or 0),
            "char_count": int(r["char_count"] or 0),
            "timestamp_start": r["timestamp_start"],
            "timestamp_end": r["timestamp_end"],
            "record_title": r["record_title"],
            "date": r["date"].date().isoformat() if r["date"] else None,
            "format": r["format"],
            "source": r["source"],
            "candidate": r["candidate"],
            "place": {"city": place_city, "state": place_state, "country": place_country},
            "record_type": r["record_type"],
            "moderation": {
                "harassment": {"flag": r["moderation_harassment_flag"], "score": r["moderation_harassment"]},
                "hate": {"flag": r["moderation_hate_flag"], "score": r["moderation_hate"]},
                "violence": {"flag": r["moderation_violence_flag"], "score": r["moderation_violence"]},
                "sexual": {"flag": r["moderation_sexual_flag"], "score": r["moderation_sexual"]},
                "selfharm": {"flag": r["moderation_selfharm_flag"], "score": r["moderation_self_harm"]},
            },
            "stresslens": {"score": r["stresslens_score"], "rank": r["stresslens_rank"]},
            "duration_s": dur,
            "video_id": int(r["video_id"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        docs.append(doc)
    return docs


async def meili_upsert(index: str, docs: List[Dict[str, Any]]) -> None:
    if not docs:
        return
    path = f"/indexes/{index}/documents"
    # Chunk to avoid huge payloads
    headers = _meili_headers()
    timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
    params = {"primaryKey": "id"}  # Specify primary key to avoid inference errors
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{settings.MEILI_HOST.rstrip('/')}{path}", headers=headers, json=docs, params=params)
        if r.status_code >= 400:
            raise RuntimeError(f"Meili upsert failed {r.status_code}: {r.text}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Postgres data into Meilisearch")
    parser.add_argument("--init", action="store_true", help="Create indexes and apply settings")
    parser.add_argument("--incremental", action="store_true", help="Run incremental sync using updated_at watermark")
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch size for upserts")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.init:
        print("Initializing Meilisearch indexes and settings...")
        ensure_indexes()
        print("Done.")

    if args.incremental:
        engine = make_engine()
        state = load_state()
        batch_size = args.batch_size
        with engine.connect() as conn:
            db = Session(bind=conn)

            # Use ISO timestamps if present
            def to_dt(val: Optional[str | float | int]) -> Optional[datetime]:
                if not val:
                    return None
                try:
                    return datetime.fromisoformat(str(val))
                except Exception:
                    return None

            last_events = to_dt(state.get("events"))
            last_segments = to_dt(state.get("segments"))

            # Segments
            print("Syncing segments to Meilisearch...")
            offset = 0
            total_count = 0
            while True:
                docs = fetch_segments_batch(db, last_segments, batch_size, offset)
                if not docs:
                    break
                asyncio.run(meili_upsert("segments", docs))
                offset += len(docs)
                total_count += len(docs)
                if len(docs) < batch_size:
                    break
            print(f"Segments synced: {total_count}")

            # Events
            print("Syncing events to Meilisearch...")
            offset = 0
            total_count = 0
            while True:
                docs = fetch_events_batch(db, last_events, batch_size, offset)
                if not docs:
                    break
                asyncio.run(meili_upsert("events", docs))
                offset += len(docs)
                total_count += len(docs)
                if len(docs) < batch_size:
                    break
            print(f"Events synced: {total_count}")

            # Update watermark to now
            now_iso = datetime.now(timezone.utc).isoformat()
            state["events"] = now_iso
            state["segments"] = now_iso
            save_state(state)
            print("Incremental sync complete.")


if __name__ == "__main__":
    main()
