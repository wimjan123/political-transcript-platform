#!/usr/bin/env python3
"""
FIXED Meilisearch Sync Script
Properly syncs PostgreSQL data to Meilisearch with correct authentication
"""
import asyncio
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from src.config import settings
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running this from the backend directory")
    sys.exit(1)

class FixedMeiliSync:
    def __init__(self):
        self.meili_host = os.getenv("MEILI_HOST", "http://localhost:7700")
        self.meili_key = os.getenv("MEILI_MASTER_KEY")
        
        if not self.meili_key:
            print("❌ ERROR: MEILI_MASTER_KEY environment variable not set")
            sys.exit(1)
            
        print(f"🔧 Using Meilisearch: {self.meili_host}")
        print(f"🔑 Using API Key: {self.meili_key[:10]}..." if self.meili_key else "❌ No API Key")
        
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.meili_key}"
        }
        
    async def test_connection(self) -> bool:
        """Test Meilisearch connection"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.meili_host}/health",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    print("✅ Meilisearch connection successful")
                    return True
                else:
                    print(f"❌ Meilisearch connection failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    async def check_index(self) -> bool:
        """Check if segments index exists"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.meili_host}/indexes/segments",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    print("✅ segments index exists")
                    return True
                elif response.status_code == 404:
                    print("❌ segments index not found")
                    return False
                else:
                    print(f"❌ Index check failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Index check error: {e}")
            return False
    
    def get_database_connection(self):
        """Get database connection"""
        try:
            # Try to get from settings first
            db_url = settings.database_url
        except:
            # Fallback to environment variables
            db_url = os.getenv(
                "DATABASE_URL", 
                "postgresql://postgres:postgres@localhost:5433/political_transcripts"
            )
        
        print(f"🗄️ Connecting to database: {db_url.split('@')[1] if '@' in db_url else 'localhost'}")
        engine = create_engine(db_url)
        return sessionmaker(bind=engine)()
    
    def fetch_segments(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """Fetch transcript segments from PostgreSQL"""
        print(f"📋 Fetching segments from database (limit: {limit})")
        
        db = self.get_database_connection()
        
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
            WHERE ts.transcript_text IS NOT NULL
            AND TRIM(ts.transcript_text) != ''
            LIMIT :limit
        """)
        
        try:
            result = db.execute(query, {"limit": limit})
            rows = result.fetchall()
            
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
            
            print(f"✅ Fetched {len(segments)} segments")
            return segments
            
        except Exception as e:
            print(f"❌ Database error: {e}")
            return []
        finally:
            db.close()
    
    async def sync_to_meilisearch(self, segments: List[Dict[str, Any]]) -> bool:
        """Sync segments to Meilisearch"""
        if not segments:
            print("⚠️ No segments to sync")
            return True
            
        print(f"🚀 Syncing {len(segments)} segments to Meilisearch...")
        
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
                    print(f"✅ Sync initiated (Task ID: {task_uid})")
                    
                    # Wait for task completion
                    return await self.wait_for_task(task_uid)
                else:
                    print(f"❌ Sync failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Sync error: {e}")
            return False
    
    async def wait_for_task(self, task_uid: int) -> bool:
        """Wait for Meilisearch task to complete"""
        print(f"⏳ Waiting for task {task_uid} to complete...")
        
        max_wait = 300  # 5 minutes
        wait_time = 0
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                while wait_time < max_wait:
                    response = await client.get(
                        f"{self.meili_host}/tasks/{task_uid}",
                        headers=self.headers
                    )
                    
                    if response.status_code == 200:
                        task = response.json()
                        status = task.get("status")
                        
                        if status == "succeeded":
                            print("✅ Task completed successfully")
                            return True
                        elif status == "failed":
                            print(f"❌ Task failed: {task.get('error', 'Unknown error')}")
                            return False
                        elif status in ["enqueued", "processing"]:
                            print(f"⏳ Task status: {status}")
                            await asyncio.sleep(2)
                            wait_time += 2
                        else:
                            print(f"⚠️ Unknown task status: {status}")
                            await asyncio.sleep(2)
                            wait_time += 2
                    else:
                        print(f"❌ Task check failed: {response.status_code}")
                        return False
                        
                print("⏰ Task wait timeout")
                return False
                
        except Exception as e:
            print(f"❌ Task wait error: {e}")
            return False
    
    async def run_sync(self, limit: int = 1000) -> bool:
        """Run complete sync process"""
        print("🔄 Starting Meilisearch sync...")
        print("=" * 50)
        
        # Test connection
        if not await self.test_connection():
            return False
            
        # Check index
        if not await self.check_index():
            return False
            
        # Fetch data
        segments = self.fetch_segments(limit)
        if not segments:
            print("❌ No segments found to sync")
            return False
            
        # Sync to Meilisearch
        success = await self.sync_to_meilisearch(segments)
        
        if success:
            print("=" * 50)
            print("✅ Meilisearch sync completed successfully!")
            print(f"📊 Synced {len(segments)} segments")
        else:
            print("❌ Sync failed")
            
        return success

async def main():
    """Main sync function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fixed Meilisearch Sync")
    parser.add_argument("--limit", type=int, default=5000, help="Maximum segments to sync")
    parser.add_argument("--test", action="store_true", help="Test connection only")
    args = parser.parse_args()
    
    syncer = FixedMeiliSync()
    
    if args.test:
        print("🧪 Testing connection only...")
        success = await syncer.test_connection() and await syncer.check_index()
        print("✅ Test passed" if success else "❌ Test failed")
        return success
    else:
        return await syncer.run_sync(args.limit)

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)