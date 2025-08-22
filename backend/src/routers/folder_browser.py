"""
API endpoints for browsing and selecting folders for video import
"""

import os
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/folders", tags=["folders"])


class FolderInfo(BaseModel):
    """Information about a folder"""
    name: str
    path: str
    is_directory: bool
    video_count: int
    srt_count: int
    size_mb: Optional[float] = None
    has_videos: bool


class FolderBrowseResponse(BaseModel):
    """Response for folder browsing"""
    current_path: str
    parent_path: Optional[str]
    folders: List[FolderInfo]
    total_folders: int
    breadcrumbs: List[Dict[str, str]]


@router.get("/browse", response_model=FolderBrowseResponse)
async def browse_folders(
    path: str = Query("/Downloads", description="Path to browse"),
    show_only_video_folders: bool = Query(False, description="Show only folders containing videos")
) -> FolderBrowseResponse:
    """
    Browse folders in the Downloads directory
    
    Args:
        path: Path to browse (relative to /Downloads)
        show_only_video_folders: If True, only show folders that contain video files
    """
    try:
        # Ensure path is within the Downloads directory for security
        base_path = "/Downloads"
        if not path.startswith("/Downloads"):
            if path.startswith("/"):
                path = path[1:]
            full_path = os.path.join(base_path, path)
        else:
            full_path = path
        
        # Normalize and validate path
        full_path = os.path.normpath(full_path)
        if not full_path.startswith(base_path):
            raise HTTPException(status_code=403, detail="Access denied - path outside Downloads directory")
        
        if not os.path.exists(full_path) or not os.path.isdir(full_path):
            raise HTTPException(status_code=404, detail="Directory not found")
        
        # Get parent path
        parent_path = None
        if full_path != base_path:
            parent_path = os.path.dirname(full_path)
        
        # Generate breadcrumbs
        breadcrumbs = []
        current = full_path
        while current and current != os.path.dirname(current):
            if current.startswith(base_path):
                name = os.path.basename(current) or "Downloads"
                breadcrumbs.insert(0, {
                    "name": name,
                    "path": current
                })
            current = os.path.dirname(current)
        
        # Get folders
        folders = []
        try:
            for item in os.listdir(full_path):
                item_path = os.path.join(full_path, item)
                
                if os.path.isdir(item_path):
                    # Count video and SRT files
                    video_count, srt_count, folder_size = _analyze_folder(item_path)
                    has_videos = video_count > 0
                    
                    # Filter by video presence if requested
                    if show_only_video_folders and not has_videos:
                        continue
                    
                    folders.append(FolderInfo(
                        name=item,
                        path=item_path,
                        is_directory=True,
                        video_count=video_count,
                        srt_count=srt_count,
                        size_mb=folder_size,
                        has_videos=has_videos
                    ))
        except PermissionError:
            logger.warning(f"Permission denied accessing directory: {full_path}")
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Sort folders by name
        folders.sort(key=lambda x: x.name.lower())
        
        return FolderBrowseResponse(
            current_path=full_path,
            parent_path=parent_path,
            folders=folders,
            total_folders=len(folders),
            breadcrumbs=breadcrumbs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing folders at {path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to browse folders: {str(e)}")


@router.get("/analyze/{folder_path:path}", response_model=FolderInfo)
async def analyze_folder(folder_path: str) -> FolderInfo:
    """
    Get detailed analysis of a specific folder
    
    Args:
        folder_path: Path to the folder to analyze
    """
    try:
        # Ensure path is within Downloads directory
        if not folder_path.startswith("/Downloads"):
            if folder_path.startswith("/"):
                folder_path = folder_path[1:]
            full_path = os.path.join("/Downloads", folder_path)
        else:
            full_path = folder_path
        
        full_path = os.path.normpath(full_path)
        if not full_path.startswith("/Downloads"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(full_path) or not os.path.isdir(full_path):
            raise HTTPException(status_code=404, detail="Folder not found")
        
        video_count, srt_count, folder_size = _analyze_folder(full_path)
        
        return FolderInfo(
            name=os.path.basename(full_path),
            path=full_path,
            is_directory=True,
            video_count=video_count,
            srt_count=srt_count,
            size_mb=folder_size,
            has_videos=video_count > 0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing folder {folder_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze folder: {str(e)}")


@router.get("/video-folders", response_model=List[FolderInfo])
async def get_video_folders(
    max_depth: int = Query(3, description="Maximum depth to search"),
    min_videos: int = Query(1, description="Minimum number of videos required")
) -> List[FolderInfo]:
    """
    Get all folders containing videos in the Downloads directory
    
    Args:
        max_depth: Maximum depth to search recursively
        min_videos: Minimum number of videos required to include folder
    """
    try:
        base_path = "/Downloads"
        if not os.path.exists(base_path):
            raise HTTPException(status_code=404, detail="Downloads directory not found")
        
        video_folders = []
        _find_video_folders(base_path, video_folders, max_depth, min_videos, 0)
        
        # Sort by video count (descending) then by name
        video_folders.sort(key=lambda x: (-x.video_count, x.name.lower()))
        
        return video_folders
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding video folders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to find video folders: {str(e)}")


def _analyze_folder(folder_path: str) -> tuple[int, int, float]:
    """
    Analyze folder contents and return video count, SRT count, and size in MB
    
    Args:
        folder_path: Path to folder to analyze
        
    Returns:
        Tuple of (video_count, srt_count, size_mb)
    """
    video_extensions = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'}
    video_count = 0
    srt_count = 0
    total_size = 0
    
    try:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    file_size = os.path.getsize(file_path)
                    total_size += file_size
                    
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in video_extensions:
                        video_count += 1
                    elif file_ext == '.srt':
                        srt_count += 1
                        
                except (OSError, PermissionError):
                    # Skip files we can't access
                    continue
                    
    except (OSError, PermissionError):
        logger.warning(f"Permission error analyzing folder: {folder_path}")
    
    size_mb = total_size / (1024 * 1024) if total_size > 0 else 0
    return video_count, srt_count, round(size_mb, 2)


def _find_video_folders(
    current_path: str,
    results: List[FolderInfo],
    max_depth: int,
    min_videos: int,
    current_depth: int
):
    """
    Recursively find folders containing videos
    
    Args:
        current_path: Current directory path
        results: List to append results to
        max_depth: Maximum recursion depth
        min_videos: Minimum videos required
        current_depth: Current recursion depth
    """
    if current_depth >= max_depth:
        return
    
    try:
        for item in os.listdir(current_path):
            item_path = os.path.join(current_path, item)
            
            if os.path.isdir(item_path):
                # Analyze this folder
                video_count, srt_count, folder_size = _analyze_folder(item_path)
                
                if video_count >= min_videos:
                    results.append(FolderInfo(
                        name=item,
                        path=item_path,
                        is_directory=True,
                        video_count=video_count,
                        srt_count=srt_count,
                        size_mb=folder_size,
                        has_videos=True
                    ))
                
                # Recurse into subdirectories
                _find_video_folders(item_path, results, max_depth, min_videos, current_depth + 1)
                
    except (OSError, PermissionError):
        logger.warning(f"Permission error accessing directory: {current_path}")
        return