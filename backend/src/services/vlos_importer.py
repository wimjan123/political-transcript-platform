"""
VLOS XML import service

Imports Tweede Kamer VLOS XML files into the database using the
same patterns as the HTML ImportService (progress callback, async DB).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..config import settings
from ..database import Base
from ..models import SegmentTopic, Speaker, Topic, TranscriptSegment, Video
from ..parsers.vlos_parser import VLOSXMLParser

logger = logging.getLogger(__name__)


class VLOSImportService:
    def __init__(self) -> None:
        self.parser = VLOSXMLParser()
        self.engine = create_async_engine(
            settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
            echo=False,
            pool_pre_ping=True,
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

        for i, file_path in enumerate(xml_files):
            if progress_callback:
                progress_callback(i, total, str(file_path), errors)
            try:
                result = await self.import_xml_file(str(file_path), force_reimport=force_reimport)
                if result.get("success"):
                    processed += 1
                else:
                    failed += 1
                    errors.append(f"{Path(file_path).name}: {result.get('error','Unknown error')}")
            except Exception as e:
                failed += 1
                errors.append(f"{Path(file_path).name}: {e}")

        if progress_callback:
            progress_callback(total, total, "", errors)

        return {
            "total_files": total,
            "total_processed": processed,
            "total_failed": failed,
            "errors": errors,
        }

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

