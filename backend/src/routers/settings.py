"""
API endpoints for application settings
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class VideoLibrarySettings(BaseModel):
    """Video library settings"""
    video_directory: str
    transcoded_directory: Optional[str] = None
    supported_formats: list[str] = ['.avi', '.mp4', '.mkv', '.mov']
    auto_transcode: bool = True


class SettingsResponse(BaseModel):
    """Settings response"""
    video_library: VideoLibrarySettings
    available_directories: list[str]


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """
    Get current application settings
    """
    try:
        # Get current video directory setting
        current_video_dir = os.getenv('VIDEO_LIBRARY_DIR', '/Downloads')
        
        # Get available directories to choose from
        available_dirs = []
        potential_dirs = ['/Downloads', '/root/video_library', '/data', '/tmp']
        
        for directory in potential_dirs:
            if os.path.exists(directory) and os.path.isdir(directory):
                try:
                    # Test if directory is readable
                    os.listdir(directory)
                    available_dirs.append(directory)
                except PermissionError:
                    # Directory exists but not readable
                    available_dirs.append(f"{directory} (access denied)")
        
        # Add current directory if it's not in the list
        if current_video_dir not in [d.split(' ')[0] for d in available_dirs]:
            if os.path.exists(current_video_dir):
                available_dirs.insert(0, current_video_dir)
            else:
                available_dirs.insert(0, f"{current_video_dir} (not found)")
        
        video_library_settings = VideoLibrarySettings(
            video_directory=current_video_dir,
            transcoded_directory=os.getenv('TRANSCODED_VIDEO_DIR', '/Downloads/transcoded'),
            supported_formats=['.avi', '.mp4', '.mkv', '.mov'],
            auto_transcode=True
        )
        
        return SettingsResponse(
            video_library=video_library_settings,
            available_directories=available_dirs
        )
        
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")


class UpdateVideoLibraryRequest(BaseModel):
    """Request to update video library settings"""
    video_directory: str


@router.put("/video-library", response_model=VideoLibrarySettings)
async def update_video_library_settings(request: UpdateVideoLibraryRequest):
    """
    Update video library settings
    
    Note: This updates the runtime configuration only.
    For persistent changes, update the VIDEO_LIBRARY_DIR environment variable.
    """
    try:
        # Validate the directory exists and is readable
        if not os.path.exists(request.video_directory):
            raise HTTPException(status_code=400, detail=f"Directory does not exist: {request.video_directory}")
        
        if not os.path.isdir(request.video_directory):
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {request.video_directory}")
        
        try:
            os.listdir(request.video_directory)
        except PermissionError:
            raise HTTPException(status_code=403, detail=f"Permission denied accessing directory: {request.video_directory}")
        
        # Update the environment variable for this session
        # Note: This won't persist across container restarts
        os.environ['VIDEO_LIBRARY_DIR'] = request.video_directory
        
        logger.info(f"Updated video library directory to: {request.video_directory}")
        
        return VideoLibrarySettings(
            video_directory=request.video_directory,
            transcoded_directory=os.getenv('TRANSCODED_VIDEO_DIR', f"{request.video_directory}/transcoded"),
            supported_formats=['.avi', '.mp4', '.mkv', '.mov'],
            auto_transcode=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating video library settings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


@router.get("/directories")
async def list_available_directories():
    """
    List directories that could be used for video storage
    """
    try:
        directories = []
        
        # Common directories to check
        potential_dirs = [
            '/Downloads',
            '/data', 
            '/tmp',
            '/root/video_library',
            '/app/videos',
            '/media',
            '/mnt'
        ]
        
        for directory in potential_dirs:
            if os.path.exists(directory) and os.path.isdir(directory):
                try:
                    contents = os.listdir(directory)
                    size = len(contents)
                    directories.append({
                        'path': directory,
                        'accessible': True,
                        'item_count': size,
                        'status': f'{size} items'
                    })
                except PermissionError:
                    directories.append({
                        'path': directory,
                        'accessible': False,
                        'item_count': 0,
                        'status': 'Access denied'
                    })
            else:
                directories.append({
                    'path': directory,
                    'accessible': False,
                    'item_count': 0,
                    'status': 'Does not exist'
                })
        
        return {'directories': directories}
        
    except Exception as e:
        logger.error(f"Error listing directories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list directories: {str(e)}")