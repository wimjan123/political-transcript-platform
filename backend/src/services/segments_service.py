"""
Service functions for transcript segments operations
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, Tuple, List
from ..models import TranscriptSegment, Video


async def fetch_segments_page(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    speaker: Optional[str] = None,
    video_id: Optional[int] = None,
    dataset: Optional[str] = None,
    q: Optional[str] = None,
) -> Tuple[List[TranscriptSegment], int]:
    """
    Fetch paginated transcript segments with optional filters
    
    Args:
        db: Database session
        page: Page number (1-based)
        page_size: Number of items per page
        speaker: Filter by speaker name (partial match)
        video_id: Filter by specific video ID
        dataset: Filter by dataset (requires join with videos table)
        q: Text search query (partial match in transcript_text)
    
    Returns:
        Tuple of (segments list, total count)
    """
    # Base query with eager loading of video relationship
    stmt = select(TranscriptSegment).options(selectinload(TranscriptSegment.video))
    
    # Apply filters
    if speaker:
        stmt = stmt.where(TranscriptSegment.speaker_name.ilike(f"%{speaker}%"))
    
    if video_id:
        stmt = stmt.where(TranscriptSegment.video_id == video_id)
    
    if dataset:
        # Join with Video table to filter by dataset
        stmt = stmt.join(TranscriptSegment.video).where(Video.dataset == dataset)
    
    if q:
        # Simple ILIKE search in transcript text
        stmt = stmt.where(TranscriptSegment.transcript_text.ilike(f"%{q}%"))
    
    # Count total results
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    
    # Apply pagination and ordering
    offset = (page - 1) * page_size
    stmt = stmt.order_by(TranscriptSegment.id).offset(offset).limit(page_size)
    
    # Execute query and return results
    result = await db.execute(stmt)
    segments = result.scalars().all()
    
    return segments, total


async def get_segment_by_id(db: AsyncSession, segment_id: int) -> Optional[TranscriptSegment]:
    """
    Get a single transcript segment by ID with related data
    
    Args:
        db: Database session
        segment_id: Segment ID to retrieve
    
    Returns:
        TranscriptSegment or None if not found
    """
    stmt = select(TranscriptSegment).options(
        selectinload(TranscriptSegment.video),
        selectinload(TranscriptSegment.speaker)
    ).where(TranscriptSegment.id == segment_id)
    
    result = await db.execute(stmt)
    return result.scalar_one_or_none()