"""
Segments API endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from ..database import get_db
from ..services.segments_service import fetch_segments_page, get_segment_by_id
from ..schemas import SegmentsPage, SegmentOut, TranscriptSegmentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/segments", tags=["segments"])


@router.get("/", response_model=SegmentsPage)
async def list_segments(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(50, ge=1, le=100, description="Number of items per page"),
    speaker: Optional[str] = Query(None, description="Filter by speaker name (partial match)"),
    video_id: Optional[int] = Query(None, description="Filter by specific video ID"),
    dataset: Optional[str] = Query(None, description="Filter by dataset (trump, tweede_kamer)"),
    q: Optional[str] = Query(None, description="Search query in transcript text"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated list of transcript segments with optional filters
    
    This endpoint provides a simplified view of transcript segments optimized for 
    listing and searching. Use the search endpoints for more advanced analytics.
    """
    try:
        # Fetch segments with pagination
        segments, total = await fetch_segments_page(
            db=db,
            page=page,
            page_size=page_size,
            speaker=speaker,
            video_id=video_id,
            dataset=dataset,
            q=q
        )
        
        # Convert to response format
        data = []
        for segment in segments:
            # Create SegmentOut dict manually to handle the aliases
            segment_dict = {
                "id": segment.id,
                "video_id": segment.video_id,
                "segment_id": segment.segment_id,
                "speaker_name": segment.speaker_name,
                "speaker_party": segment.speaker_party,
                "transcript_text": segment.transcript_text,
                "timestamp_start": segment.timestamp_start,
                "timestamp_end": segment.timestamp_end,
                "video_seconds": segment.video_seconds,
                "word_count": segment.word_count,
                "char_count": segment.char_count,
                "sentiment_vader_score": segment.sentiment_vader_score,
                "sentiment_harvard_score": segment.sentiment_harvard_score,
                "sentiment_loughran_score": segment.sentiment_loughran_score,
                "emotion_label": segment.emotion_label,
                "emotion_intensity": segment.emotion_intensity,
                "heat_score": segment.heat_score,
                "heat_components": segment.heat_components,
                "created_at": segment.created_at,
                "updated_at": segment.updated_at
            }
            data.append(SegmentOut.model_validate(segment_dict))
        
        # Calculate pagination metadata
        total_pages = (total + page_size - 1) // page_size
        
        return SegmentsPage(
            data=data,
            pagination={
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            message="Success",
            status_code=200
        )
    
    except Exception as e:
        logger.error(f"Error fetching segments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch segments: {str(e)}")


@router.get("/{segment_id}", response_model=TranscriptSegmentResponse)
async def get_segment(
    segment_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single transcript segment by ID with full details
    
    Returns complete segment information including related video and speaker data.
    """
    try:
        segment = await get_segment_by_id(db, segment_id)
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
        
        return segment
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching segment {segment_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch segment: {str(e)}")