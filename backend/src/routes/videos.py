"""
Video management endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date

from ..database import get_db
from ..models import Video, TranscriptSegment, Speaker, SegmentTopic
from ..schemas import VideoResponse, VideoCreateRequest, VideoUpdateRequest, TranscriptSegmentResponse

router = APIRouter()


@router.get("/", response_model=List[VideoResponse])
async def get_videos(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Results per page"),
    source: Optional[str] = Query(None, description="Filter by source"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    search: Optional[str] = Query(None, description="Search in title"),
    sort_by: str = Query("date", description="Sort by: date, title, source"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of videos with filtering and pagination
    """
    try:
        query = select(Video)
        
        # Apply filters
        conditions = []
        if source:
            conditions.append(Video.source.ilike(f"%{source}%"))
        if date_from:
            conditions.append(Video.date >= date_from)
        if date_to:
            conditions.append(Video.date <= date_to)
        if search:
            conditions.append(Video.title.ilike(f"%{search}%"))
        
        if conditions:
            query = query.where(*conditions)
        
        # Apply sorting
        if sort_by == "date":
            order_col = Video.date
        elif sort_by == "title":
            order_col = Video.title
        elif sort_by == "source":
            order_col = Video.source
        else:
            order_col = Video.created_at
        
        if sort_order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await db.execute(query)
        videos = result.scalars().all()
        
        # Attach primary speaker info for each video (top speaker by segment count)
        enriched_results = []
        for video in videos:
            vr = VideoResponse.from_orm(video)
            try:
                top_speaker_q = select(
                    TranscriptSegment.speaker_name,
                    TranscriptSegment.speaker_party,
                    func.count(TranscriptSegment.id).label('cnt')
                ).where(TranscriptSegment.video_id == video.id).group_by(
                    TranscriptSegment.speaker_name, TranscriptSegment.speaker_party
                ).order_by(desc('cnt')).limit(1)
                top_res = await db.execute(top_speaker_q)
                top_row = top_res.first()
                if top_row:
                    # Assign primary speaker fields if available
                    vr.primary_speaker_name = top_row.speaker_name
                    vr.primary_speaker_party = top_row.speaker_party
            except Exception:
                # Non-fatal; continue without primary speaker
                pass
            enriched_results.append(vr)
        
        return enriched_results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching videos: {str(e)}")


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific video by ID
    """
    try:
        query = select(Video).where(Video.id == video_id)
        result = await db.execute(query)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return VideoResponse.from_orm(video)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching video: {str(e)}")


@router.get("/{video_id}/segments", response_model=List[TranscriptSegmentResponse], response_model_exclude_none=True)
async def get_video_segments(
    video_id: int = Path(..., description="Video ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Results per page"),
    speaker: Optional[str] = Query(None, description="Filter by speaker"),
    q: Optional[str] = Query(None, description="Filter by keyword in transcript text"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get transcript segments for a specific video
    """
    try:
        # First check if video exists
        video_query = select(Video).where(Video.id == video_id)
        video_result = await db.execute(video_query)
        video = video_result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Build segments query
        query = select(TranscriptSegment).options(
            selectinload(TranscriptSegment.video),
            # Eager-load Speaker to prevent async lazy-loading issues during serialization
            selectinload(TranscriptSegment.speaker),
            # Ensure topic relationship is eagerly loaded to avoid lazy-load issues
            selectinload(TranscriptSegment.segment_topics).selectinload(SegmentTopic.topic)
        ).where(TranscriptSegment.video_id == video_id)
        
        # Apply filters
        if speaker:
            query = query.where(TranscriptSegment.speaker_name.ilike(f"%{speaker}%"))
        if q:
            query = query.where(TranscriptSegment.transcript_text.ilike(f"%{q}%"))
        
        # Order by video seconds
        query = query.order_by(TranscriptSegment.video_seconds)
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await db.execute(query)
        segments = result.scalars().all()
        
        return [TranscriptSegmentResponse.from_orm(segment) for segment in segments]
    
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Error fetching video segments")
        raise HTTPException(status_code=500, detail=f"Error fetching video segments: {str(e)}")


@router.get("/{video_id}/stats")
async def get_video_stats(
    video_id: int = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics for a specific video
    """
    try:
        # Check if video exists
        video_query = select(Video).where(Video.id == video_id)
        video_result = await db.execute(video_query)
        video = video_result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Get segment count
        segment_count_query = select(func.count(TranscriptSegment.id)).where(TranscriptSegment.video_id == video_id)
        segment_count_result = await db.execute(segment_count_query)
        total_segments = segment_count_result.scalar_one()
        
        # Get speaker count and distribution
        speaker_stats_query = select(
            TranscriptSegment.speaker_name,
            func.count(TranscriptSegment.id).label('segment_count'),
            func.sum(TranscriptSegment.word_count).label('total_words'),
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment')
        ).where(TranscriptSegment.video_id == video_id).group_by(TranscriptSegment.speaker_name).order_by(desc('segment_count'))
        
        speaker_stats_result = await db.execute(speaker_stats_query)
        speaker_stats = [
            {
                "speaker": row.speaker_name,
                "segment_count": row.segment_count,
                "total_words": row.total_words or 0,
                "avg_sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0
            }
            for row in speaker_stats_result
        ]
        
        # Get overall statistics
        overall_stats_query = select(
            func.sum(TranscriptSegment.word_count).label('total_words'),
            func.avg(TranscriptSegment.sentiment_loughran_score).label('avg_sentiment'),
            func.avg(TranscriptSegment.flesch_kincaid_grade).label('avg_readability'),
            func.max(TranscriptSegment.video_seconds).label('duration_seconds')
        ).where(TranscriptSegment.video_id == video_id)
        
        overall_result = await db.execute(overall_stats_query)
        overall = overall_result.first()
        
        # Get sentiment distribution
        sentiment_dist_query = select(
            case(
                (TranscriptSegment.sentiment_loughran_score > 0, 'positive'),
                (TranscriptSegment.sentiment_loughran_score < 0, 'negative'),
                else_='neutral'
            ).label('sentiment'),
            func.count().label('count')
        ).where(TranscriptSegment.video_id == video_id).group_by('sentiment')
        
        sentiment_dist_result = await db.execute(sentiment_dist_query)
        sentiment_distribution = {row.sentiment: row.count for row in sentiment_dist_result}
        
        return {
            "video_id": video_id,
            "total_segments": total_segments,
            "total_words": overall.total_words or 0,
            "avg_sentiment": float(overall.avg_sentiment) if overall.avg_sentiment else 0,
            "avg_readability": float(overall.avg_readability) if overall.avg_readability else 0,
            "duration_seconds": overall.duration_seconds or 0,
            "speaker_stats": speaker_stats,
            "sentiment_distribution": sentiment_distribution
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching video stats: {str(e)}")


@router.post("/", response_model=VideoResponse)
async def create_video(
    video_data: VideoCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new video record
    """
    try:
        # Check if filename already exists
        existing_query = select(Video).where(Video.filename == video_data.filename)
        existing_result = await db.execute(existing_query)
        existing_video = existing_result.scalar_one_or_none()
        
        if existing_video:
            raise HTTPException(status_code=400, detail="Video with this filename already exists")
        
        # Create new video
        new_video = Video(**video_data.dict())
        db.add(new_video)
        await db.commit()
        await db.refresh(new_video)
        
        return VideoResponse.from_orm(new_video)
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating video: {str(e)}")


@router.put("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: int = Path(..., description="Video ID"),
    video_data: VideoUpdateRequest = ...,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a video record
    """
    try:
        # Get existing video
        query = select(Video).where(Video.id == video_id)
        result = await db.execute(query)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Update fields
        for field, value in video_data.dict(exclude_unset=True).items():
            setattr(video, field, value)
        
        await db.commit()
        await db.refresh(video)
        
        return VideoResponse.from_orm(video)
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating video: {str(e)}")


@router.delete("/{video_id}")
async def delete_video(
    video_id: int = Path(..., description="Video ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a video and all its segments
    """
    try:
        # Get existing video
        query = select(Video).where(Video.id == video_id)
        result = await db.execute(query)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Delete video (cascade will delete segments)
        await db.delete(video)
        await db.commit()
        
        return {"message": "Video deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting video: {str(e)}")
