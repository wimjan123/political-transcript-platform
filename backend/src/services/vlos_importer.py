"""
VLOS XML import service

Imports Tweede Kamer VLOS XML files into the database using the
same patterns as the HTML ImportService (progress callback, async DB).
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..config import settings
from ..database import Base
from ..models import SegmentTopic, Speaker, Topic, TranscriptSegment, Video
from ..parsers.vlos_parser import VLOSXMLParser
from .import_progress_tracker import ImportProgressTracker

logger = logging.getLogger(__name__)


class VLOSImportService:
    def __init__(self, max_concurrent_files: int = 2) -> None:  # Reduced from 4 to 2
        self.parser = VLOSXMLParser()
        self.max_concurrent_files = max_concurrent_files
        self.semaphore = asyncio.Semaphore(max_concurrent_files)
        self.chunk_size = 50  # Process files in chunks of 50
        self.progress_update_interval = 10  # Update progress every 10 files
        self.engine = create_async_engine(
            settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
            echo=False,
            pool_pre_ping=True,
            pool_size=max_concurrent_files + 5,  # Extra connections for safety
            max_overflow=max_concurrent_files,
        )
        self.SessionLocal = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    async def import_xml_directory(
        self,
        xml_dir: str,
        force_reimport: bool = False,
        progress_callback: Optional[Callable[[int, int, str, List[str]], None]] = None,
    ) -> Dict[str, Any]:
        xml_files = sorted(Path(xml_dir).glob("*.xml"))
        total = len(xml_files)
        processed = 0
        failed = 0
        errors: List[str] = []
        
        logger.info(f"Starting VLOS XML import: {total} files found in {xml_dir}")
        
        # Initialize progress tracker
        async with self.SessionLocal() as tracker_session:
            progress_tracker = ImportProgressTracker(tracker_session)
            job_id = await progress_tracker.start_job("vlos_xml_import", total)
        
        # Process files in smaller chunks to avoid overwhelming the system
        for chunk_start in range(0, total, self.chunk_size):
            # Check for cancellation before each chunk
            async with self.SessionLocal() as check_session:
                check_status = await ImportProgressTracker.get_latest_job_status(check_session)
                if check_status and check_status["status"] == "cancelled":
                    logger.info(f"Import job {job_id} was cancelled, stopping processing")
                    return {
                        "job_id": job_id,
                        "total_files": total,
                        "total_processed": processed,
                        "total_failed": failed,
                        "errors": errors + ["Import was cancelled by user"],
                    }
            
            chunk_end = min(chunk_start + self.chunk_size, total)
            chunk_files = xml_files[chunk_start:chunk_end]
            
            logger.info(f"Processing chunk {chunk_start//self.chunk_size + 1}/{(total + self.chunk_size - 1)//self.chunk_size}: files {chunk_start+1}-{chunk_end}")
            
            # Process each chunk with limited concurrency
            chunk_tasks = []
            for i in range(0, len(chunk_files), self.max_concurrent_files):
                batch = chunk_files[i:i + self.max_concurrent_files]
                batch_tasks = [
                    self._import_xml_file_with_semaphore(str(file_path), force_reimport)
                    for file_path in batch
                ]
                
                # Execute batch and collect results
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                # Process results
                for file_path, result in zip(batch, batch_results):
                    current_index = chunk_start + len(chunk_tasks)
                    
                    if isinstance(result, Exception):
                        failed += 1
                        error_msg = f"{Path(file_path).name}: {str(result)}"
                        errors.append(error_msg)
                        logger.error(f"Import failed for {file_path}: {result}")
                    elif result.get("success"):
                        processed += 1
                        if processed % 20 == 0:  # Log every 20 successful imports
                            logger.info(f"Progress: {processed}/{total} files processed successfully")
                    else:
                        failed += 1
                        error_msg = f"{Path(file_path).name}: {result.get('error','Unknown error')}"
                        errors.append(error_msg)
                        logger.warning(f"Import failed for {file_path}: {error_msg}")
                    
                    chunk_tasks.append(result)
                    
                # Update progress tracker after each batch
                async with self.SessionLocal() as tracker_session:
                    tracker = ImportProgressTracker(tracker_session)
                    tracker.job_id = job_id
                    await tracker.update_progress(
                        processed_files=processed,
                        failed_files=failed,
                        current_file=str(file_path) if 'file_path' in locals() else None,
                        errors=errors[-10:]  # Keep only last 10 errors for database efficiency
                    )
                    
                # Update progress callback if provided
                if progress_callback:
                    progress_callback(processed + failed, total, str(file_path) if 'file_path' in locals() else "", errors)
            
            # Small delay between chunks to prevent system overload
            if chunk_end < total:
                await asyncio.sleep(2)

        # Mark job as completed in progress tracker
        try:
            async with self.SessionLocal() as tracker_session:
                tracker = ImportProgressTracker(tracker_session)
                tracker.job_id = job_id
                status = "completed" if failed == 0 else ("completed" if processed > 0 else "failed")
                await tracker.complete_job(status=status, final_errors=errors[-20:])  # Keep last 20 errors
        except Exception as e:
            logger.error(f"Failed to update progress tracker completion: {e}")

        if progress_callback:
            progress_callback(total, total, "", errors)

        logger.info(f"VLOS XML import completed: {processed} successful, {failed} failed out of {total} total files")
        
        return {
            "job_id": job_id,
            "total_files": total,
            "total_processed": processed,
            "total_failed": failed,
            "errors": errors,
        }

    async def _import_xml_file_with_semaphore(self, file_path: str, force_reimport: bool = False) -> Dict[str, Any]:
        """Import a single XML file with semaphore-based concurrency control"""
        async with self.semaphore:
            return await self.import_xml_file(file_path, force_reimport)

    async def import_xml_file(self, file_path: str, force_reimport: bool = False) -> Dict[str, Any]:
        try:
            filename = Path(file_path).name
            parsed = self.parser.parse_file(file_path)
            if not parsed.get("segments"):
                return {"success": False, "error": "No utterances found"}

            async with self.SessionLocal() as db:
                existing_q = select(Video).where(Video.filename == filename)
                res = await db.execute(existing_q)
                existing = res.scalar_one_or_none()
                if existing and not force_reimport:
                    return {"success": True, "message": "Video already exists, skipping", "video_id": existing.id}
                if existing and force_reimport:
                    # Delete existing segments
                    await db.execute(select(TranscriptSegment).where(TranscriptSegment.video_id == existing.id))
                    await db.commit()
                    video = existing
                else:
                    vm = {**parsed["video_metadata"], "dataset": "tweede_kamer", "source_type": "xml"}
                    video = Video(**vm)
                    db.add(video)
                    await db.commit()
                    await db.refresh(video)

                await self._process_segments(db, video, parsed["segments"])
                await db.commit()
                return {"success": True, "video_id": video.id, "segments_imported": len(parsed["segments"]) }
        except Exception as e:
            logger.exception("VLOS XML import failed")
            return {"success": False, "error": str(e)}

    async def _process_segments(self, db: AsyncSession, video: Video, segments: List[Dict[str, Any]]) -> None:
        speaker_cache: Dict[str, Speaker] = {}
        for seg in segments:
            speaker = await self._get_or_create_speaker(db, seg.get("speaker_name") or "", speaker_cache)
            payload = {k: v for k, v in seg.items() if k in TranscriptSegment.__table__.columns.keys()}
            ts = TranscriptSegment(video_id=video.id, speaker_id=speaker.id if speaker else None, **payload)
            db.add(ts)
            # No topics for now; can be extended when present in XML
            await db.flush()

    async def _get_or_create_speaker(self, db: AsyncSession, speaker_name: str, cache: Dict[str, Speaker]) -> Optional[Speaker]:
        speaker_name = (speaker_name or "").strip()
        if not speaker_name:
            return None
        norm = speaker_name.lower().replace(" ", "_")
        if norm in cache:
            return cache[norm]
        res = await db.execute(select(Speaker).where(Speaker.normalized_name == norm))
        sp = res.scalar_one_or_none()
        if not sp:
            sp = Speaker(name=speaker_name, normalized_name=norm)
            db.add(sp)
            await db.flush()
        cache[norm] = sp
        return sp

