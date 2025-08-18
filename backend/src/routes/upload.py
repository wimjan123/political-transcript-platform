"""
Upload and import endpoints for the Political Transcript Search Platform
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

from ..database import get_db
from ..services.import_service import ImportService
from ..services.vlos_importer import VLOSImportService
from ..schemas import ImportStatusResponse
from ..config import settings

router = APIRouter()

# Global import status storage (in production, use Redis or database)
import_status = {
    "job_type": None,
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
    max_concurrent: int = Query(4, ge=1, le=10, description="Max concurrent file processing (1-10)"),
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
            "job_type": "html",
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
            force_reimport,
            max_concurrent
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


async def run_html_import(html_dir: str, force_reimport: bool = False, max_concurrent: int = 4):
    """
    Background task to import HTML files
    """
    try:
        import_status["status"] = "running"
        
        # Create import service
        import_service = ImportService(max_concurrent_files=max_concurrent)
        
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


@router.post("/import-vlos-xml")
async def start_vlos_xml_import(
    background_tasks: BackgroundTasks,
    source_dir: Optional[str] = Query(None, description="Source directory (defaults to XML_DATA_DIR)"),
    force_reimport: bool = Query(False, description="Force reimport of existing files"),
    max_concurrent: int = Query(4, ge=1, le=10, description="Max concurrent file processing (1-10)"),
    db: AsyncSession = Depends(get_db),
):
    """Start importing Tweede Kamer VLOS XML files in the background"""
    try:
        if import_status["status"] == "running":
            raise HTTPException(status_code=400, detail="Import is already running")

        xml_dir = source_dir or settings.XML_DATA_DIR
        
        # Check primary directory first, then fallback to raw_xml directory
        xml_files_in_primary = []
        if os.path.exists(xml_dir):
            try:
                xml_files_in_primary = list(Path(xml_dir).glob("*.xml"))
            except Exception as e:
                logger.warning(f"Error checking primary directory {xml_dir}: {e}")
        
        if not os.path.exists(xml_dir) or len(xml_files_in_primary) == 0:
            # Generate fallback path: /xml/ -> /raw_xml/ or /xml -> /raw_xml
            fallback_dir = xml_dir.rstrip('/')
            if fallback_dir.endswith('/xml'):
                fallback_dir = fallback_dir[:-4] + '/raw_xml'
            elif '/xml/' in fallback_dir:
                fallback_dir = fallback_dir.replace('/xml/', '/raw_xml/')
            
            if os.path.exists(fallback_dir):
                try:
                    xml_files_in_fallback = list(Path(fallback_dir).glob("*.xml"))
                    if len(xml_files_in_fallback) > 0:
                        xml_dir = fallback_dir
                        logger.info(f"Primary XML directory empty or missing, using fallback with {len(xml_files_in_fallback)} files: {xml_dir}")
                    else:
                        raise HTTPException(status_code=400, detail=f"No XML files found in {xml_dir} or fallback {fallback_dir}")
                except Exception as e:
                    logger.error(f"Error checking fallback directory {fallback_dir}: {e}")
                    raise HTTPException(status_code=400, detail=f"Error accessing fallback directory: {e}")
            else:
                raise HTTPException(status_code=400, detail=f"XML source directory does not exist: {xml_dir} (also checked {fallback_dir})")
        
        # Final check that we can actually access the chosen directory
        if not os.path.exists(xml_dir):
            raise HTTPException(status_code=400, detail=f"Selected XML directory does not exist: {xml_dir}")

        import_status.update({
            "job_type": "vlos_xml",
            "status": "starting",
            "progress": 0.0,
            "total_files": 0,
            "processed_files": 0,
            "failed_files": 0,
            "current_file": None,
            "errors": [],
            "estimated_completion": None,
        })

        background_tasks.add_task(run_vlos_import, xml_dir, force_reimport, max_concurrent)

        return {"message": "VLOS XML import started", "status": "starting", "source_directory": xml_dir}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting VLOS XML import: {str(e)}")


async def run_vlos_import(xml_dir: str, force_reimport: bool = False, max_concurrent: int = 4):
    try:
        import_status["status"] = "running"

        service = VLOSImportService(max_concurrent_files=max_concurrent)

        def progress_callback(current: int, total: int, current_file: str, errors: list):
            import_status.update({
                "progress": (current / total) * 100 if total > 0 else 0,
                "total_files": total,
                "processed_files": current,
                "failed_files": len(errors),
                "current_file": current_file,
                "errors": errors[-10:],
            })

        result = await service.import_xml_directory(
            xml_dir, force_reimport=force_reimport, progress_callback=progress_callback
        )

        import_status.update({
            "status": "completed",
            "progress": 100.0,
            "current_file": None,
            "processed_files": result["total_processed"],
            "failed_files": result["total_failed"],
        })
    except Exception as e:
        import_status.update({"status": "failed", "errors": import_status["errors"] + [str(e)]})


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


@router.websocket("/ws/import-status")
async def import_status_ws(ws: WebSocket):
    await ws.accept()
    try:
        # Send initial snapshot
        await ws.send_json(import_status)
        # Periodic updates
        while True:
            await asyncio.sleep(1)
            await ws.send_json(import_status)
            if import_status.get("status") in {"completed", "failed", "cancelled"}:
                break
    except WebSocketDisconnect:
        return


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


@router.delete("/clear-dataset")
async def clear_dataset_data(
    dataset: str = Query(..., description="Dataset to clear (e.g., 'tweede_kamer')"),
    confirm: bool = Query(False, description="Confirmation flag"),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all data associated with a specific dataset.

    Targets videos with the given dataset (and source_type='xml' for 'tweede_kamer'),
    then removes dependent transcript_segments and segment_topics in a safe order.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="This operation requires confirmation. Add ?confirm=true to the request."
        )
    try:
        from sqlalchemy import text
        extra_source_filter = " AND v.source_type = 'xml'" if dataset == 'tweede_kamer' else ""

        # Delete segment_topics first
        await db.execute(text(
            f"""
            DELETE FROM segment_topics st
            USING transcript_segments s, videos v
            WHERE st.segment_id = s.id
              AND s.video_id = v.id
              AND v.dataset = :dataset{extra_source_filter}
            """
        ), {"dataset": dataset})

        # Delete transcript_segments
        await db.execute(text(
            f"""
            DELETE FROM transcript_segments s
            USING videos v
            WHERE s.video_id = v.id
              AND v.dataset = :dataset{extra_source_filter}
            """
        ), {"dataset": dataset})

        # Delete videos
        await db.execute(text(
            f"""
            DELETE FROM videos v
            WHERE v.dataset = :dataset{extra_source_filter}
            """
        ), {"dataset": dataset})

        await db.commit()
        return {"message": f"Cleared dataset '{dataset}' successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing dataset '{dataset}': {str(e)}")
