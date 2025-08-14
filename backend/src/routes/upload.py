"""
Upload and import endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import asyncio
import os
from pathlib import Path

from ..database import get_db
from ..services.import_service import ImportService
from ..schemas import ImportStatusResponse
from ..config import settings

router = APIRouter()

# Global import status storage (in production, use Redis or database)
import_status = {
    "status": "idle",
    "progress": 0.0,
    "total_files": 0,
    "processed_files": 0,
    "failed_files": 0,
    "current_file": None,
    "errors": [],
    "estimated_completion": None
}


@router.post("/import-html")
async def start_html_import(
    background_tasks: BackgroundTasks,
    source_dir: Optional[str] = Query(None, description="Source directory (defaults to config)"),
    force_reimport: bool = Query(False, description="Force reimport of existing files"),
    db: AsyncSession = Depends(get_db)
):
    """
    Start importing HTML transcript files in the background
    """
    try:
        # Check if import is already running
        if import_status["status"] == "running":
            raise HTTPException(status_code=400, detail="Import is already running")
        
        # Use configured directory if not specified
        html_dir = source_dir or settings.HTML_DATA_DIR
        
        if not os.path.exists(html_dir):
            raise HTTPException(status_code=400, detail=f"Source directory does not exist: {html_dir}")
        
        # Reset status
        import_status.update({
            "status": "starting",
            "progress": 0.0,
            "total_files": 0,
            "processed_files": 0,
            "failed_files": 0,
            "current_file": None,
            "errors": [],
            "estimated_completion": None
        })
        
        # Start background import
        background_tasks.add_task(
            run_html_import,
            html_dir,
            force_reimport
        )
        
        return {
            "message": "HTML import started",
            "status": "starting",
            "source_directory": html_dir
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting import: {str(e)}")


async def run_html_import(html_dir: str, force_reimport: bool = False):
    """
    Background task to import HTML files
    """
    try:
        import_status["status"] = "running"
        
        # Create import service
        import_service = ImportService()
        
        # Set up progress callback
        def progress_callback(current: int, total: int, current_file: str, errors: list):
            import_status.update({
                "progress": (current / total) * 100 if total > 0 else 0,
                "total_files": total,
                "processed_files": current,
                "failed_files": len(errors),
                "current_file": current_file,
                "errors": errors[-10:]  # Keep last 10 errors
            })
        
        # Run import
        result = await import_service.import_html_directory(
            html_dir,
            force_reimport=force_reimport,
            progress_callback=progress_callback
        )
        
        # Update final status
        import_status.update({
            "status": "completed",
            "progress": 100.0,
            "current_file": None,
            "processed_files": result["total_processed"],
            "failed_files": result["total_failed"]
        })
        
    except Exception as e:
        import_status.update({
            "status": "failed",
            "errors": import_status["errors"] + [str(e)]
        })


@router.get("/import-status", response_model=ImportStatusResponse)
async def get_import_status():
    """
    Get the current status of the HTML import process
    """
    return ImportStatusResponse(**import_status)


@router.post("/import-cancel")
async def cancel_import():
    """
    Cancel the current import process
    """
    if import_status["status"] not in ["running", "starting"]:
        raise HTTPException(status_code=400, detail="No import process is currently running")
    
    import_status["status"] = "cancelled"
    return {"message": "Import process cancelled"}


@router.post("/import-file")
async def import_single_file(
    file_path: str = Query(..., description="Path to HTML file to import"),
    force_reimport: bool = Query(False, description="Force reimport if file already exists"),
    db: AsyncSession = Depends(get_db)
):
    """
    Import a single HTML transcript file
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail=f"File does not exist: {file_path}")
        
        if not file_path.endswith('.html'):
            raise HTTPException(status_code=400, detail="File must be an HTML file")
        
        # Create import service
        import_service = ImportService()
        
        # Import single file
        result = await import_service.import_html_file(file_path, force_reimport=force_reimport)
        
        return {
            "message": "File imported successfully",
            "file_path": file_path,
            "result": result
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing file: {str(e)}")


@router.get("/import-stats")
async def get_import_stats(db: AsyncSession = Depends(get_db)):
    """
    Get statistics about imported data
    """
    try:
        from sqlalchemy import select, func
        from ..models import Video, TranscriptSegment, Speaker, Topic
        
        # Get counts
        video_count_query = select(func.count(Video.id))
        video_result = await db.execute(video_count_query)
        total_videos = video_result.scalar_one()
        
        segment_count_query = select(func.count(TranscriptSegment.id))
        segment_result = await db.execute(segment_count_query)
        total_segments = segment_result.scalar_one()
        
        speaker_count_query = select(func.count(Speaker.id))
        speaker_result = await db.execute(speaker_count_query)
        total_speakers = speaker_result.scalar_one()
        
        topic_count_query = select(func.count(Topic.id))
        topic_result = await db.execute(topic_count_query)
        total_topics = topic_result.scalar_one()
        
        # Get recent imports
        recent_videos_query = select(Video).order_by(Video.created_at.desc()).limit(10)
        recent_result = await db.execute(recent_videos_query)
        recent_videos = recent_result.scalars().all()
        
        return {
            "total_videos": total_videos,
            "total_segments": total_segments,
            "total_speakers": total_speakers,
            "total_topics": total_topics,
            "recent_imports": [
                {
                    "id": video.id,
                    "title": video.title,
                    "filename": video.filename,
                    "imported_at": video.created_at.isoformat()
                }
                for video in recent_videos
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching import stats: {str(e)}")


@router.delete("/clear-data")
async def clear_all_data(
    confirm: bool = Query(False, description="Confirmation flag"),
    db: AsyncSession = Depends(get_db)
):
    """
    Clear all imported data (use with caution)
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="This operation requires confirmation. Add ?confirm=true to the request."
        )
    
    try:
        from sqlalchemy import text
        
        # Delete all data in correct order (respecting foreign keys)
        await db.execute(text("DELETE FROM segment_topics"))
        await db.execute(text("DELETE FROM transcript_segments"))
        await db.execute(text("DELETE FROM videos"))
        await db.execute(text("DELETE FROM topics"))
        await db.execute(text("DELETE FROM speakers"))
        
        await db.commit()
        
        return {"message": "All data cleared successfully"}
    
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing data: {str(e)}")