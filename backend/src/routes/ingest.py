"""
Video ingestion endpoints for the Political Transcript Search Platform
"""
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from datetime import datetime

from ..database import get_db
from ..services.youtube_service import youtube_service
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Global storage for processing status
processing_status = {}

class YouTubeIngestRequest(BaseModel):
    url: HttpUrl
    openai_api_key: str
    title_override: Optional[str] = None
    speaker_override: Optional[str] = None

class IngestStatus(BaseModel):
    status: str
    progress: str
    video_id: Optional[int] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None

@router.post("/youtube")
async def start_youtube_ingestion(
    request: YouTubeIngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Start processing a YouTube video for transcription and ingestion
    """
    try:
        # Validate URL
        video_id = youtube_service.extract_video_id(str(request.url))
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
            
        # Check if already processing
        if video_id in processing_status and processing_status[video_id]["status"] == "processing":
            return {"message": "Video is already being processed", "video_id": video_id}
            
        # Initialize processing status
        processing_status[video_id] = {
            "status": "processing",
            "progress": "Starting...",
            "video_id": None,
            "error": None,
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "result": None
        }
        
        # Start background processing
        background_tasks.add_task(
            process_youtube_video_background,
            video_id,
            str(request.url),
            request.openai_api_key,
            db
        )
        
        return {
            "message": "YouTube video processing started",
            "video_id": video_id,
            "status": "processing"
        }
        
    except Exception as e:
        logger.error(f"Error starting YouTube ingestion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")

async def process_youtube_video_background(
    video_id: str,
    url: str,
    openai_api_key: str,
    db: AsyncSession
):
    """Background task to process YouTube video"""
    async def update_progress(message: str):
        if video_id in processing_status:
            processing_status[video_id]["progress"] = message
            logger.info(f"Processing {video_id}: {message}")
    
    try:
        # Process the video
        result = await youtube_service.process_youtube_video(
            db=db,
            url=url,
            openai_api_key=openai_api_key,
            progress_callback=update_progress
        )
        
        # Update status with success
        processing_status[video_id].update({
            "status": "completed",
            "progress": "Processing complete",
            "video_id": result["video_id"],
            "completed_at": datetime.utcnow(),
            "result": result
        })
        
        logger.info(f"Successfully processed YouTube video {video_id}")
        
    except Exception as e:
        logger.error(f"Error processing YouTube video {video_id}: {str(e)}")
        processing_status[video_id].update({
            "status": "error",
            "progress": f"Error: {str(e)}",
            "error": str(e),
            "completed_at": datetime.utcnow()
        })

@router.get("/status/{video_id}")
async def get_processing_status(video_id: str):
    """
    Get the processing status of a YouTube video ingestion
    """
    if video_id not in processing_status:
        raise HTTPException(status_code=404, detail="Video processing not found")
        
    status = processing_status[video_id].copy()
    
    # Convert datetime objects to ISO strings for JSON serialization
    if status["started_at"]:
        status["started_at"] = status["started_at"].isoformat()
    if status["completed_at"]:
        status["completed_at"] = status["completed_at"].isoformat()
        
    return status

@router.get("/status")
async def get_all_processing_status():
    """
    Get the processing status of all ongoing/recent video ingestions
    """
    statuses = {}
    for video_id, status in processing_status.items():
        status_copy = status.copy()
        # Convert datetime objects to ISO strings
        if status_copy["started_at"]:
            status_copy["started_at"] = status_copy["started_at"].isoformat()
        if status_copy["completed_at"]:
            status_copy["completed_at"] = status_copy["completed_at"].isoformat()
        statuses[video_id] = status_copy
    
    return statuses

@router.delete("/status/{video_id}")
async def clear_processing_status(video_id: str):
    """
    Clear the processing status for a video (cleanup)
    """
    if video_id not in processing_status:
        raise HTTPException(status_code=404, detail="Video processing not found")
        
    del processing_status[video_id]
    return {"message": "Processing status cleared"}

@router.get("/video-info")
async def get_youtube_video_info(url: str):
    """
    Get basic information about a YouTube video without processing it
    """
    try:
        video_info = await youtube_service.get_video_info(url)
        
        # Return basic info for preview
        return {
            "video_id": video_info["video_id"],
            "title": video_info["title"],
            "duration": video_info["duration"],
            "uploader": video_info["uploader"],
            "channel": video_info["channel"],
            "thumbnail": video_info["thumbnail"],
            "upload_date": video_info["formatted_date"].isoformat() if video_info["formatted_date"] else None,
            "view_count": video_info.get("view_count", 0)
        }
        
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to get video information: {str(e)}")

@router.post("/test-api-key")
async def test_openai_api_key(request: dict):
    """
    Test if an OpenAI API key is valid
    """
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")
        
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        # Make a simple test request
        response = client.models.list()
        
        # Check if whisper-1 model is available
        models = [model.id for model in response.data]
        whisper_available = "whisper-1" in models
        
        return {
            "valid": True,
            "whisper_available": whisper_available,
            "message": "API key is valid" + (" and Whisper is available" if whisper_available else " but Whisper model not found")
        }
        
    except Exception as e:
        logger.error(f"Error testing API key: {str(e)}")
        return {
            "valid": False,
            "whisper_available": False,
            "message": f"API key test failed: {str(e)}"
        }