"""
VLOS XML import service

Imports Tweede Kamer VLOS XML files into the database using the
same patterns as the HTML ImportService (progress callback, async DB).
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import aiofiles
from aiomultiprocess import Pool as AioPool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..config import settings
from ..database import Base
from ..models import SegmentTopic, Speaker, Topic, TranscriptSegment, Video
from ..parsers.vlos_parser import VLOSXMLParser
from .import_progress_tracker import ImportProgressTracker

logger = logging.getLogger(__name__)


# Standalone function for multiprocessing (must be at module level)
async def parse_xml_file_async(file_path: str) -> Dict[str, Any]:
    """Parse a single XML file asynchronously using aiofiles and return structured data."""
    try:
        # Use async file I/O for reading
        async with aiofiles.open(file_path, 'rb') as f:
            raw = await f.read()
        
        # Parse using optimized approach
        from ..parsers.vlos_parser import VLOSXMLParser
        parser = VLOSXMLParser()
        
        # Use the new parse_content method if available, fallback to file-based parsing
        if hasattr(parser, 'parse_content'):
            result = parser.parse_content(raw, file_path)
        else:
            # Convert bytes to string for parser
            try:
                text = raw.decode("utf-8")
            except Exception:
                text = raw.decode("latin-1")
                
            # Create temporary file for parser (it expects file path)
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as tmp:
                tmp.write(text)
                temp_path = tmp.name
            
            try:
                result = parser.parse_file(temp_path)
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
        
        result['original_file_path'] = file_path
        return {"success": True, "data": result, "file_path": file_path}
                
    except Exception as e:
        return {"success": False, "error": str(e), "file_path": file_path}


class VLOSImportService:
    def __init__(self, max_concurrent_files: int = 8) -> None:  # Increased from 2 to 8
        self.parser = VLOSXMLParser()
        self.max_concurrent_files = max_concurrent_files
        self.semaphore = asyncio.Semaphore(max_concurrent_files)
        self.chunk_size = 100  # Increased from 50 to 100
        self.progress_update_interval = 20  # Update progress every 20 files
        
        # Determine optimal CPU count for multiprocessing
        cpu_count = os.cpu_count() or 4
        self.process_pool_size = min(max_concurrent_files, max(2, cpu_count - 1))
        
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
        
        # Use aiomultiprocess for high-performance XML parsing
        async with AioPool(processes=self.process_pool_size, childconcurrency=2) as process_pool:
            # Process files in chunks using multiprocessing
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
                
                logger.info(f"Processing chunk {chunk_start//self.chunk_size + 1}/{(total + self.chunk_size - 1)//self.chunk_size}: files {chunk_start+1}-{chunk_end} using {self.process_pool_size} processes")
                
                # Parse files using multiprocessing pool
                parse_results = []
                async for parse_result in process_pool.map(parse_xml_file_async, [str(f) for f in chunk_files]):
                    parse_results.append(parse_result)
                
                # Now process parsed data and save to database
                for parse_result in parse_results:
                    file_path = parse_result["file_path"]
                    
                    if not parse_result.get("success"):
                        failed += 1
                        error_msg = f"{Path(file_path).name}: {parse_result.get('error', 'Unknown error')}"
                        errors.append(error_msg)
                        logger.error(f"Parse failed for {file_path}: {parse_result.get('error')}")
                        continue
                    
                    # Save parsed data to database
                    try:
                        import_result = await self._save_parsed_data_to_db(parse_result["data"], force_reimport)
                        if import_result.get("success"):
                            processed += 1
                            if processed % 20 == 0:  # Log every 20 successful imports
                                logger.info(f"Progress: {processed}/{total} files processed successfully")
                        else:
                            failed += 1
                            error_msg = f"{Path(file_path).name}: {import_result.get('error', 'Database save failed')}"
                            errors.append(error_msg)
                            logger.error(f"Database save failed for {file_path}: {import_result.get('error')}")
                    except Exception as e:
                        failed += 1
                        error_msg = f"{Path(file_path).name}: Database save exception: {str(e)}"
                        errors.append(error_msg)
                        logger.exception(f"Database save exception for {file_path}")
                
                # Update progress tracker after each chunk
                async with self.SessionLocal() as tracker_session:
                    tracker = ImportProgressTracker(tracker_session)
                    tracker.job_id = job_id
                    await tracker.update_progress(
                        processed_files=processed,
                        failed_files=failed,
                        current_file=None,  # No current file when processing in chunks
                        errors=errors[-10:]  # Keep only last 10 errors for database efficiency
                    )
                    
                # Update progress callback if provided
                if progress_callback:
                    progress_callback(processed + failed, total, "", errors)

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
    
    async def _save_parsed_data_to_db(self, parsed_data: Dict[str, Any], force_reimport: bool = False) -> Dict[str, Any]:
        """Save parsed XML data to database efficiently."""
        try:
            filename = Path(parsed_data["video_metadata"]["filename"]).name
            
            async with self.SessionLocal() as db:
                # Check if video already exists
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
                    # Create new video
                    vm = {**parsed_data["video_metadata"], "dataset": "tweede_kamer", "source_type": "xml"}
                    video = Video(**vm)
                    db.add(video)
                    await db.commit()
                    await db.refresh(video)

                # Save segments
                await self._process_segments(db, video, parsed_data["segments"])
                await db.commit()
                
                return {"success": True, "video_id": video.id, "segments_imported": len(parsed_data["segments"])}
                
        except Exception as e:
            logger.exception("Failed to save parsed data to database")
            return {"success": False, "error": str(e)}

