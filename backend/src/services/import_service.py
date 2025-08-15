"""
Import service for processing HTML transcript files
"""
import os
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from datetime import datetime

from ..parsers.html_parser import TranscriptHTMLParser
from ..models import Video, Speaker, Topic, TranscriptSegment, SegmentTopic
from ..database import Base
from ..config import settings
from .embedding_service import embedding_service

logger = logging.getLogger(__name__)


class ImportService:
    """Service for importing HTML transcript files into the database"""
    
    def __init__(self):
        self.parser = TranscriptHTMLParser()
        self.engine = create_async_engine(
            settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
            echo=False,
            pool_pre_ping=True
        )
        self.SessionLocal = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
    
    async def import_html_directory(
        self,
        html_dir: str,
        force_reimport: bool = False,
        generate_embeddings: bool = True,
        progress_callback: Optional[Callable[[int, int, str, List[str]], None]] = None
    ) -> Dict[str, Any]:
        """
        Import all HTML files from a directory
        
        Args:
            html_dir: Directory containing HTML files
            force_reimport: Whether to reimport existing files
            generate_embeddings: Whether to generate embeddings after import
            progress_callback: Callback for progress updates
            
        Returns:
            Dictionary with import results
        """
        html_files = list(Path(html_dir).glob("*.html"))
        total_files = len(html_files)
        processed_files = 0
        failed_files = 0
        errors = []
        
        logger.info(f"Starting import of {total_files} HTML files from {html_dir}")
        
        for i, file_path in enumerate(html_files):
            try:
                if progress_callback:
                    progress_callback(i, total_files, str(file_path), errors)
                
                result = await self.import_html_file(str(file_path), force_reimport)
                if result["success"]:
                    processed_files += 1
                else:
                    failed_files += 1
                    errors.append(f"{file_path.name}: {result.get('error', 'Unknown error')}")
                
            except Exception as e:
                failed_files += 1
                error_msg = f"{file_path.name}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Error importing {file_path}: {str(e)}")
        
        # Final progress update
        if progress_callback:
            progress_callback(total_files, total_files, "", errors)
        
        logger.info(f"Import completed: {processed_files} successful, {failed_files} failed")
        
        # Generate embeddings if requested and there were successful imports
        embedding_stats = None
        if generate_embeddings and processed_files > 0:
            logger.info("Starting embedding generation for newly imported segments")
            try:
                async with self.SessionLocal() as db:
                    embedding_stats = await embedding_service.generate_embeddings_for_segments(
                        db=db,
                        force_regenerate=False  # Only generate for new segments
                    )
                logger.info(f"Embedding generation completed: {embedding_stats}")
            except Exception as e:
                logger.error(f"Error generating embeddings: {str(e)}")
                errors.append(f"Embedding generation failed: {str(e)}")
        
        return {
            "total_files": total_files,
            "total_processed": processed_files,
            "total_failed": failed_files,
            "errors": errors,
            "embedding_stats": embedding_stats
        }
    
    async def import_html_file(self, file_path: str, force_reimport: bool = False) -> Dict[str, Any]:
        """
        Import a single HTML transcript file
        
        Args:
            file_path: Path to the HTML file
            force_reimport: Whether to reimport if video already exists
            
        Returns:
            Dictionary with import result
        """
        try:
            filename = Path(file_path).name
            
            async with self.SessionLocal() as db:
                # Check if video already exists
                existing_video_query = select(Video).where(Video.filename == filename)
                result = await db.execute(existing_video_query)
                existing_video = result.scalar_one_or_none()
                
                if existing_video and not force_reimport:
                    return {
                        "success": True,
                        "message": "Video already exists, skipping",
                        "video_id": existing_video.id
                    }
                
                # Parse HTML file
                parsed_data = self.parser.parse_file(file_path)
                
                if not parsed_data["segments"]:
                    return {
                        "success": False,
                        "error": "No transcript segments found in file"
                    }
                
                # Import or update video
                if existing_video and force_reimport:
                    # Delete existing segments
                    await db.execute(
                        select(TranscriptSegment).where(TranscriptSegment.video_id == existing_video.id)
                    )
                    await db.commit()
                    video = existing_video
                else:
                    # Create new video
                    video_data = parsed_data["video_metadata"]
                    video = Video(**video_data)
                    db.add(video)
                    await db.commit()
                    await db.refresh(video)
                
                # Process segments
                await self._process_segments(db, video, parsed_data["segments"])
                
                await db.commit()
                
                return {
                    "success": True,
                    "message": "File imported successfully",
                    "video_id": video.id,
                    "segments_imported": len(parsed_data["segments"])
                }
        
        except Exception as e:
            logger.error(f"Error importing {file_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _process_segments(self, db: AsyncSession, video: Video, segments_data: List[Dict[str, Any]]):
        """Process and import transcript segments"""
        
        # Create speaker lookup cache
        speaker_cache = {}
        topic_cache = {}
        
        for segment_data in segments_data:
            try:
                # Get or create speaker
                speaker = await self._get_or_create_speaker(db, segment_data["speaker_name"], speaker_cache)
                
                # Create segment
                segment = TranscriptSegment(
                    video_id=video.id,
                    speaker_id=speaker.id if speaker else None,
                    **{k: v for k, v in segment_data.items() if k in TranscriptSegment.__table__.columns.keys()}
                )
                
                db.add(segment)
                await db.flush()  # Get segment ID
                
                # Process topics if present
                if "primary_topic" in segment_data and segment_data["primary_topic"]:
                    topic = await self._get_or_create_topic(db, segment_data["primary_topic"], topic_cache)
                    if topic:
                        segment_topic = SegmentTopic(
                            segment_id=segment.id,
                            topic_id=topic.id,
                            score=1.0,  # Default score for primary topic
                            confidence=1.0
                        )
                        db.add(segment_topic)
                
            except Exception as e:
                logger.warning(f"Error processing segment: {str(e)}")
                continue
    
    async def _get_or_create_speaker(
        self, 
        db: AsyncSession, 
        speaker_name: str, 
        cache: Dict[str, Speaker]
    ) -> Optional[Speaker]:
        """Get existing speaker or create new one"""
        
        if not speaker_name or speaker_name.strip() == "":
            return None
        
        speaker_name = speaker_name.strip()
        normalized_name = speaker_name.lower().replace(" ", "_")
        
        # Check cache first
        if normalized_name in cache:
            return cache[normalized_name]
        
        # Check database
        speaker_query = select(Speaker).where(Speaker.normalized_name == normalized_name)
        result = await db.execute(speaker_query)
        speaker = result.scalar_one_or_none()
        
        if not speaker:
            # Create new speaker
            speaker = Speaker(
                name=speaker_name,
                normalized_name=normalized_name
            )
            db.add(speaker)
            await db.flush()
        
        # Cache for future use
        cache[normalized_name] = speaker
        return speaker
    
    async def _get_or_create_topic(
        self, 
        db: AsyncSession, 
        topic_name: str, 
        cache: Dict[str, Topic]
    ) -> Optional[Topic]:
        """Get existing topic or create new one"""
        
        if not topic_name or topic_name.strip() == "":
            return None
        
        topic_name = topic_name.strip()
        
        # Check cache first
        if topic_name in cache:
            return cache[topic_name]
        
        # Check database
        topic_query = select(Topic).where(Topic.name == topic_name)
        result = await db.execute(topic_query)
        topic = result.scalar_one_or_none()
        
        if not topic:
            # Create new topic
            topic = Topic(
                name=topic_name,
                category=self._categorize_topic(topic_name)
            )
            db.add(topic)
            await db.flush()
        
        # Cache for future use
        cache[topic_name] = topic
        return topic
    
    def _categorize_topic(self, topic_name: str) -> str:
        """Categorize topic based on name"""
        topic_lower = topic_name.lower()
        
        # Define topic categories
        if any(term in topic_lower for term in ["economy", "economic", "finance", "trade", "tax", "budget"]):
            return "Economy"
        elif any(term in topic_lower for term in ["health", "healthcare", "medical", "pandemic", "covid"]):
            return "Healthcare"
        elif any(term in topic_lower for term in ["immigration", "border", "refugee", "migrant"]):
            return "Immigration"
        elif any(term in topic_lower for term in ["defense", "military", "security", "war", "foreign"]):
            return "Defense & Security"
        elif any(term in topic_lower for term in ["environment", "climate", "energy", "green"]):
            return "Environment"
        elif any(term in topic_lower for term in ["education", "school", "student", "university"]):
            return "Education"
        elif any(term in topic_lower for term in ["civil rights", "justice", "equality", "discrimination"]):
            return "Civil Rights"
        elif any(term in topic_lower for term in ["technology", "tech", "digital", "internet", "cyber"]):
            return "Technology"
        else:
            return "Other"
    
    async def update_speaker_stats(self, db: AsyncSession):
        """Update speaker statistics after import"""
        from sqlalchemy import func, update
        
        # Update speaker stats
        speaker_stats_query = select(
            TranscriptSegment.speaker_id,
            func.count(TranscriptSegment.id).label('total_segments'),
            func.sum(TranscriptSegment.word_count).label('total_words'),
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment')
        ).where(TranscriptSegment.speaker_id.isnot(None)).group_by(TranscriptSegment.speaker_id)
        
        result = await db.execute(speaker_stats_query)
        
        for row in result:
            await db.execute(
                update(Speaker).where(Speaker.id == row.speaker_id).values(
                    total_segments=row.total_segments,
                    total_words=row.total_words or 0,
                    avg_sentiment=row.avg_sentiment
                )
            )
        
        await db.commit()
    
    async def update_topic_stats(self, db: AsyncSession):
        """Update topic statistics after import"""
        from sqlalchemy import func, update
        
        # Update topic stats
        topic_stats_query = select(
            SegmentTopic.topic_id,
            func.count(SegmentTopic.id).label('total_segments'),
            func.avg(SegmentTopic.score).label('avg_score')
        ).group_by(SegmentTopic.topic_id)
        
        result = await db.execute(topic_stats_query)
        
        for row in result:
            await db.execute(
                update(Topic).where(Topic.id == row.topic_id).values(
                    total_segments=row.total_segments,
                    avg_score=row.avg_score
                )
            )
        
        await db.commit()
    
    async def generate_embeddings_for_all_segments(
        self, 
        force_regenerate: bool = False,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Generate embeddings for all transcript segments in the database
        
        Args:
            force_regenerate: Whether to regenerate embeddings for segments that already have them
            batch_size: Number of segments to process in each batch
            
        Returns:
            Dictionary with processing statistics
        """
        logger.info("Starting embedding generation for all transcript segments")
        
        async with self.SessionLocal() as db:
            result = await embedding_service.generate_embeddings_for_segments(
                db=db,
                force_regenerate=force_regenerate,
                batch_size=batch_size
            )
        
        logger.info(f"Embedding generation completed: {result}")
        return result