"""
Transcript summarization API routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..services.summarization_service import summarization_service

router = APIRouter()


class SummaryRequest(BaseModel):
    bullet_points: int = Field(default=4, ge=3, le=5, description="Number of bullet points (3-5)")
    custom_prompt: Optional[str] = Field(default=None, description="Custom prompt for summarization")
    provider: Optional[str] = Field(default=None, description="AI provider (openai or openrouter)")
    model: Optional[str] = Field(default=None, description="Model name/ID")
    api_key: Optional[str] = Field(default=None, description="API key for the provider")


class BatchSummaryRequest(BaseModel):
    video_ids: List[int] = Field(..., min_items=1, max_items=10, description="List of video IDs (max 10)")
    bullet_points: int = Field(default=4, ge=3, le=5, description="Number of bullet points (3-5)")


class SummaryResponse(BaseModel):
    video_id: int
    video_title: str
    summary: str
    bullet_points: int
    metadata: dict


class SummaryStatsResponse(BaseModel):
    total_videos: int
    videos_with_transcripts: int
    average_segments_per_video: float
    summarization_available: bool
    model_used: str


@router.post("/video/{video_id}/summary", response_model=SummaryResponse)
async def create_video_summary(
    video_id: int,
    request: SummaryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a bullet-point summary of a video transcript
    
    - **video_id**: ID of the video to summarize
    - **bullet_points**: Number of bullet points to generate (3-5)
    - **custom_prompt**: Optional custom prompt for summarization
    - **provider**: AI provider (openai or openrouter)
    - **model**: Model name/ID to use
    - **api_key**: API key for the provider
    """
    try:
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Summarization request: video_id={video_id}, provider={request.provider}, model={request.model}, has_api_key={bool(request.api_key)}")
        
        result = await summarization_service.summarize_video_transcript(
            db=db,
            video_id=video_id,
            bullet_points=request.bullet_points,
            custom_prompt=request.custom_prompt,
            provider=request.provider,
            model=request.model,
            api_key=request.api_key
        )
        logger.info(f"Summarization successful for video {video_id}")
        return SummaryResponse(**result)
    except ValueError as e:
        logger.error(f"ValueError in summarization: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        logger.error(f"RuntimeError in summarization: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in summarization: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@router.post("/videos/summary", response_model=List[SummaryResponse])
async def create_batch_summaries(
    request: BatchSummaryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate summaries for multiple videos in batch
    
    - **video_ids**: List of video IDs to summarize (max 10)
    - **bullet_points**: Number of bullet points per summary (3-5)
    """
    try:
        results = await summarization_service.batch_summarize_videos(
            db=db,
            video_ids=request.video_ids,
            bullet_points=request.bullet_points
        )
        
        # Filter out error results and return only successful summaries
        successful_results = []
        for result in results:
            if "error" not in result and result.get("summary"):
                successful_results.append(SummaryResponse(**result))
        
        return successful_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch summaries: {str(e)}")


@router.get("/stats", response_model=SummaryStatsResponse)
async def get_summarization_stats(db: AsyncSession = Depends(get_db)):
    """
    Get statistics about videos available for summarization
    
    Returns information about:
    - Total number of videos
    - Videos with transcript data
    - Average segments per video
    - Summarization service availability
    """
    try:
        stats = await summarization_service.get_video_summary_stats(db)
        return SummaryStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summarization stats: {str(e)}")


@router.get("/video/{video_id}/can-summarize")
async def check_video_can_summarize(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a video can be summarized (has transcript segments)
    
    - **video_id**: ID of the video to check
    """
    try:
        from sqlalchemy import select, func
        from ..models import TranscriptSegment, Video
        
        # Check if video exists
        video_query = select(Video).where(Video.id == video_id)
        video_result = await db.execute(video_query)
        video = video_result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail=f"Video with ID {video_id} not found")
        
        # Count segments for this video
        segment_count_query = select(func.count(TranscriptSegment.id)).where(
            TranscriptSegment.video_id == video_id
        )
        count_result = await db.execute(segment_count_query)
        segment_count = count_result.scalar_one()
        
        return {
            "video_id": video_id,
            "video_title": video.title,
            "can_summarize": segment_count > 0,
            "segment_count": segment_count,
            "summarization_available": summarization_service.client is not None or True  # Fallback available
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check video summarization: {str(e)}")


@router.get("/video/{video_id}/cached-summary")
async def get_cached_summary(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get cached summary for a video if it exists
    
    - **video_id**: ID of the video to check for cached summary
    """
    try:
        from sqlalchemy import select
        from ..models import VideoSummary
        
        query = (
            select(VideoSummary)
            .where(VideoSummary.video_id == video_id)
            .options(selectinload(VideoSummary.video))
        )
        
        result = await db.execute(query)
        cached_summary = result.scalar_one_or_none()
        
        if not cached_summary:
            raise HTTPException(status_code=404, detail="No cached summary found for this video")
        
        return {
            "video_id": cached_summary.video_id,
            "video_title": cached_summary.video.title,
            "summary": cached_summary.summary_text,
            "bullet_points": cached_summary.bullet_points,
            "metadata": {
                **(cached_summary.summary_metadata or {}),
                "cached": True,
                "generated_at": cached_summary.generated_at.isoformat(),
                "provider_used": cached_summary.provider,
                "model_used": cached_summary.model
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cached summary: {str(e)}")


@router.delete("/video/{video_id}/cached-summary")
async def delete_cached_summary(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete cached summary for a video to force regeneration
    
    - **video_id**: ID of the video to clear cached summary for
    """
    try:
        from sqlalchemy import select
        from ..models import VideoSummary
        
        query = select(VideoSummary).where(VideoSummary.video_id == video_id)
        result = await db.execute(query)
        cached_summary = result.scalar_one_or_none()
        
        if not cached_summary:
            raise HTTPException(status_code=404, detail="No cached summary found for this video")
        
        await db.delete(cached_summary)
        await db.commit()
        
        return {"message": f"Cached summary deleted for video {video_id}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete cached summary: {str(e)}")


@router.get("/models/info")
async def get_summarization_model_info():
    """
    Get information about the summarization models and capabilities
    """
    try:
        from ..services.summarization_service import HAS_OPENAI
        
        return {
            "openai_available": HAS_OPENAI,
            "primary_model": summarization_service.model if HAS_OPENAI else None,
            "fallback_method": "extractive",
            "max_tokens_per_summary": summarization_service.max_tokens_per_summary,
            "supported_bullet_points": {"min": 3, "max": 5},
            "batch_limit": 10
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")