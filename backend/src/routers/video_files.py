"""
API endpoints for video file management, import, and streaming
"""

import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database import get_db
from ..models import Video
from ..services.video_import_service import get_video_import_service
from ..services.video_transcoding_service import get_transcoding_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video-files", tags=["video-files"])


class VideoImportStats(BaseModel):
    """Video import statistics response"""
    discovered: int
    imported: int
    skipped: int
    errors: int


class TranscodingStats(BaseModel):
    """Transcoding statistics response"""
    pending: int
    processed: int
    successful: int
    failed: int


class VideoFileInfo(BaseModel):
    """Video file information response"""
    id: int
    title: str
    filename: str
    video_file_path: Optional[str]
    srt_file_path: Optional[str]
    video_format: Optional[str]
    video_file_size: Optional[int]
    video_duration_seconds: Optional[float]
    video_resolution: Optional[str]
    video_fps: Optional[float]
    transcoding_status: Optional[str]
    transcoded_file_path: Optional[str]
    has_subtitles: bool
    playback_ready: bool


class VideoImportRequest(BaseModel):
    """Request model for video import"""
    force_reimport: bool = False
    video_directory: Optional[str] = None
    selected_folders: Optional[List[str]] = None


@router.post("/import", response_model=VideoImportStats)
async def import_video_files(
    request: VideoImportRequest,
    background_tasks: BackgroundTasks
) -> VideoImportStats:
    """
    Import video files and their SRT subtitles from directory or selected folders
    
    Args:
        request: Import configuration including force_reimport, video_directory, and selected_folders
    """
    try:
        import_service = get_video_import_service(request.video_directory)
        
        # Import from selected folders or entire directory
        if request.selected_folders:
            stats = import_service.import_from_folders(
                request.selected_folders, 
                force_reimport=request.force_reimport
            )
        else:
            stats = import_service.import_all_videos(force_reimport=request.force_reimport)
        
        # Start transcoding for any newly imported videos that need it
        if stats['imported'] > 0:
            background_tasks.add_task(transcode_pending_videos)
        
        return VideoImportStats(**stats)
        
    except Exception as e:
        logger.error(f"Error importing video files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/transcode", response_model=TranscodingStats)
async def transcode_videos(
    background_tasks: BackgroundTasks,
    video_id: Optional[int] = None
) -> TranscodingStats:
    """
    Transcode videos for web playback
    
    Args:
        video_id: Specific video ID to transcode (optional, transcodes all pending if not provided)
    """
    try:
        transcoding_service = get_transcoding_service()
        
        if video_id:
            # Transcode specific video
            success = transcoding_service.transcode_video_by_id(video_id)
            return TranscodingStats(
                pending=1,
                processed=1,
                successful=1 if success else 0,
                failed=0 if success else 1
            )
        else:
            # Transcode all pending videos in background
            background_tasks.add_task(transcode_pending_videos)
            return TranscodingStats(pending=0, processed=0, successful=0, failed=0)
        
    except Exception as e:
        logger.error(f"Error transcoding videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcoding failed: {str(e)}")


@router.get("/list", response_model=List[VideoFileInfo])
async def list_video_files(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    format_filter: Optional[str] = None,
    status_filter: Optional[str] = None
) -> List[VideoFileInfo]:
    """
    List video files with their metadata
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        format_filter: Filter by video format (e.g., 'avi', 'mp4')
        status_filter: Filter by transcoding status
    """
    try:
        query = db.query(Video).filter(Video.video_file_path.isnot(None))
        
        if format_filter:
            query = query.filter(Video.video_format == format_filter.lower())
        
        if status_filter:
            query = query.filter(Video.transcoding_status == status_filter)
        
        videos = query.offset(skip).limit(limit).all()
        
        video_files = []
        for video in videos:
            video_files.append(VideoFileInfo(
                id=video.id,
                title=video.title,
                filename=video.filename,
                video_file_path=video.video_file_path,
                srt_file_path=video.srt_file_path,
                video_format=video.video_format,
                video_file_size=video.video_file_size,
                video_duration_seconds=video.video_duration_seconds,
                video_resolution=video.video_resolution,
                video_fps=video.video_fps,
                transcoding_status=video.transcoding_status,
                transcoded_file_path=video.transcoded_file_path,
                has_subtitles=bool(video.srt_file_path and os.path.exists(video.srt_file_path or '')),
                playback_ready=(
                    video.transcoding_status == 'completed' or 
                    (video.video_format == 'mp4' and video.transcoding_status != 'failed')
                )
            ))
        
        return video_files
        
    except Exception as e:
        logger.error(f"Error listing video files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list video files: {str(e)}")


@router.get("/{video_id}/info", response_model=VideoFileInfo)
async def get_video_info(video_id: int, db: Session = Depends(get_db)) -> VideoFileInfo:
    """Get detailed information about a specific video file"""
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return VideoFileInfo(
        id=video.id,
        title=video.title,
        filename=video.filename,
        video_file_path=video.video_file_path,
        srt_file_path=video.srt_file_path,
        video_format=video.video_format,
        video_file_size=video.video_file_size,
        video_duration_seconds=video.video_duration_seconds,
        video_resolution=video.video_resolution,
        video_fps=video.video_fps,
        transcoding_status=video.transcoding_status,
        transcoded_file_path=video.transcoded_file_path,
        has_subtitles=bool(video.srt_file_path and os.path.exists(video.srt_file_path or '')),
        playback_ready=(
            video.transcoding_status == 'completed' or 
            (video.video_format == 'mp4' and video.transcoding_status != 'failed')
        )
    )


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: int, 
    db: Session = Depends(get_db),
    range_header: Optional[str] = None
):
    """
    Stream video file with range support for web players
    
    Args:
        video_id: Video ID
        range_header: HTTP Range header for partial content requests
    """
    try:
        transcoding_service = get_transcoding_service()
        video_path = transcoding_service.get_video_playback_path(video_id)
        
        if not video_path or not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Get video info for content type
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Determine content type
        content_type = "video/mp4" if video_path.endswith('.mp4') else "video/avi"
        
        # Handle range requests for video streaming
        if range_header:
            return _handle_range_request(video_path, range_header, content_type)
        
        # Return full video file
        return FileResponse(
            path=video_path,
            media_type=content_type,
            filename=video.filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error streaming video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to stream video")


@router.get("/{video_id}/subtitles")
async def get_subtitles(video_id: int, db: Session = Depends(get_db)):
    """
    Get SRT subtitles for a video
    
    Args:
        video_id: Video ID
    """
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if not video.srt_file_path or not os.path.exists(video.srt_file_path):
            raise HTTPException(status_code=404, detail="Subtitles not found")
        
        return FileResponse(
            path=video.srt_file_path,
            media_type="text/srt",
            filename=f"{video.filename}.srt"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subtitles for video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get subtitles")


@router.get("/{video_id}/thumbnail")
async def get_video_thumbnail(video_id: int, db: Session = Depends(get_db)):
    """
    Generate and return video thumbnail
    
    Args:
        video_id: Video ID
    """
    try:
        transcoding_service = get_transcoding_service()
        video_path = transcoding_service.get_video_playback_path(video_id)
        
        if not video_path or not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Generate thumbnail using FFmpeg (this is a simplified version)
        # In production, you might want to cache thumbnails
        import ffmpeg
        
        thumbnail_path = f"/tmp/thumbnail_{video_id}.jpg"
        try:
            (
                ffmpeg
                .input(video_path, ss=10)  # Take frame at 10 seconds
                .filter('scale', 320, -1)
                .output(thumbnail_path, vframes=1)
                .overwrite_output()
                .run(quiet=True)
            )
            
            if os.path.exists(thumbnail_path):
                return FileResponse(
                    path=thumbnail_path,
                    media_type="image/jpeg",
                    filename=f"thumbnail_{video_id}.jpg"
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
                
        except Exception as e:
            logger.error(f"FFmpeg error generating thumbnail: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating thumbnail for video {video_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail")


def _handle_range_request(file_path: str, range_header: str, content_type: str):
    """Handle HTTP range requests for video streaming"""
    
    file_size = os.path.getsize(file_path)
    
    # Parse range header (format: "bytes=start-end")
    range_match = range_header.replace('bytes=', '').split('-')
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if range_match[1] else file_size - 1
    
    # Ensure end doesn't exceed file size
    end = min(end, file_size - 1)
    chunk_size = end - start + 1
    
    def generate_chunks():
        with open(file_path, 'rb') as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                chunk = f.read(min(8192, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
    
    return StreamingResponse(
        generate_chunks(),
        status_code=206,
        media_type=content_type,
        headers={
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(chunk_size),
            'Cache-Control': 'no-cache',
        }
    )


async def transcode_pending_videos():
    """Background task to transcode pending videos"""
    try:
        transcoding_service = get_transcoding_service()
        stats = transcoding_service.transcode_all_pending_videos()
        logger.info(f"Background transcoding completed: {stats}")
    except Exception as e:
        logger.error(f"Background transcoding failed: {str(e)}")