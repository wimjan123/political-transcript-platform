#!/usr/bin/env python3
"""
Automatic Meilisearch Sync Service
Monitors PostgreSQL for changes and keeps Meilisearch index updated
"""
import asyncio
import logging
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.config import settings
from src.database import get_db_engine
from sqlalchemy import text
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AutoMeiliSync:
    def __init__(self):
        self.meili_host = os.getenv("MEILI_HOST", "http://localhost:7700")
        self.meili_key = os.getenv("MEILI_MASTER_KEY")
        
        if not self.meili_key:
            logger.error("MEILI_MASTER_KEY environment variable not set")
            sys.exit(1)
            
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.meili_key}"
        }
        
        # Track last sync timestamp
        self.last_sync = datetime.min
        
    async def check_for_updates(self) -> List[Dict[str, Any]]:
        """Check for new/updated segments since last sync"""
        engine = get_db_engine()
        
        query = text("""
            SELECT 
                ts.id,
                ts.segment_id,
                ts.transcript_text,
                ts.speaker_name,
                ts.video_id,
                ts.video_seconds,
                ts.timestamp_start,
                ts.timestamp_end,
                ts.word_count,
                ts.char_count,
                ts.sentiment_loughran_score,
                ts.flesch_kincaid_grade,
                ts.stresslens_score,
                ts.stresslens_rank,
                ts.moderation_harassment_flag,
                ts.moderation_hate_flag,
                ts.moderation_violence_flag,
                ts.moderation_sexual_flag,
                ts.moderation_selfharm_flag,
                ts.updated_at,
                v.title as video_title,
                v.source,
                v.date as video_date,
                v.dataset,
                v.format as video_format,
                v.candidate as video_candidate,
                v.place as video_place,
                v.record_type as video_record_type,
                v.video_thumbnail_url
            FROM transcript_segments ts
            LEFT JOIN videos v ON ts.video_id = v.id
            WHERE ts.updated_at > :last_sync
            AND ts.transcript_text IS NOT NULL
            AND TRIM(ts.transcript_text) != ''
            ORDER BY ts.updated_at ASC
            LIMIT 1000
        """)
        
        with engine.begin() as conn:
            result = conn.execute(query, {"last_sync": self.last_sync})
            rows = result.fetchall()
            
            if not rows:
                return []
                
            segments = []
            for row in rows:
                segment = {
                    "id": row.id,
                    "segment_id": row.segment_id,
                    "transcript_text": row.transcript_text,
                    "speaker_name": row.speaker_name or "Unknown",
                    "video_id": row.video_id,
                    "video_seconds": row.video_seconds,
                    "timestamp_start": row.timestamp_start,
                    "timestamp_end": row.timestamp_end,
                    "word_count": row.word_count or 0,
                    "char_count": row.char_count or 0,
                    "sentiment_loughran_score": row.sentiment_loughran_score or 0.0,
                    "flesch_kincaid_grade": row.flesch_kincaid_grade or 0.0,
                    "stresslens_score": row.stresslens_score or 0.0,
                    "stresslens_rank": row.stresslens_rank,
                    "moderation_harassment_flag": row.moderation_harassment_flag or False,
                    "moderation_hate_flag": row.moderation_hate_flag or False,
                    "moderation_violence_flag": row.moderation_violence_flag or False,
                    "moderation_sexual_flag": row.moderation_sexual_flag or False,
                    "moderation_selfharm_flag": row.moderation_selfharm_flag or False,
                    "video_title": row.video_title or "",
                    "source": row.source or "",
                    "video_date": int(row.video_date.timestamp()) if row.video_date else 0,
                    "dataset": row.dataset or "",
                    "video_format": row.video_format or "",
                    "video_candidate": row.video_candidate or "",
                    "video_place": row.video_place or "",
                    "video_record_type": row.video_record_type or "",
                    "video_thumbnail_url": row.video_thumbnail_url or ""
                }
                segments.append(segment)
                
                # Update last sync timestamp
                if row.updated_at > self.last_sync:
                    self.last_sync = row.updated_at
            
            logger.info(f"Found {len(segments)} updated segments")
            return segments
    
    async def sync_to_meilisearch(self, segments: List[Dict[str, Any]]) -> bool:
        """Sync segments to Meilisearch"""
        if not segments:
            return True
            
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.meili_host}/indexes/segments/documents",
                    headers=self.headers,
                    json=segments
                )
                
                if response.status_code in [200, 202]:
                    result = response.json()
                    task_uid = result.get("taskUid")
                    logger.info(f"Sync initiated for {len(segments)} segments (Task ID: {task_uid})")
                    return True
                else:
                    logger.error(f"Sync failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Sync error: {e}")
            return False
    
    async def run_continuous_sync(self, check_interval: int = 30):
        """Run continuous sync checking for updates every N seconds"""
        logger.info(f"Starting automatic Meilisearch sync (check interval: {check_interval}s)")
        
        while True:
            try:
                # Check for updates
                segments = await self.check_for_updates()
                
                if segments:
                    logger.info(f"Syncing {len(segments)} updated segments...")
                    success = await self.sync_to_meilisearch(segments)
                    
                    if success:
                        logger.info("✅ Sync completed successfully")
                    else:
                        logger.error("❌ Sync failed")
                else:
                    logger.debug("No updates found")
                    
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
            
            # Wait before next check
            await asyncio.sleep(check_interval)


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Automatic Meilisearch Sync")
    parser.add_argument("--interval", type=int, default=30, help="Check interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run once instead of continuous")
    args = parser.parse_args()
    
    syncer = AutoMeiliSync()
    
    if args.once:
        logger.info("Running one-time sync...")
        segments = await syncer.check_for_updates()
        if segments:
            await syncer.sync_to_meilisearch(segments)
        logger.info("One-time sync completed")
    else:
        await syncer.run_continuous_sync(args.interval)


if __name__ == "__main__":
    asyncio.run(main())