"""
Debug endpoints for troubleshooting
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/debug", tags=["debug"])


class SystemInfo(BaseModel):
    """System information response"""
    downloads_dir_exists: bool
    downloads_dir_readable: bool
    downloads_dir_contents_count: int
    current_working_directory: str
    environment_variables: dict


@router.get("/system-info", response_model=SystemInfo)
async def get_system_info():
    """
    Get system information for debugging
    """
    downloads_dir = "/Downloads"
    
    # Check if Downloads directory exists
    downloads_exists = os.path.exists(downloads_dir)
    
    # Check if Downloads directory is readable
    downloads_readable = False
    contents_count = 0
    
    if downloads_exists:
        try:
            contents = os.listdir(downloads_dir)
            downloads_readable = True
            contents_count = len(contents)
        except PermissionError:
            downloads_readable = False
    
    # Get current working directory
    cwd = os.getcwd()
    
    # Get relevant environment variables
    env_vars = {
        "DATABASE_URL": os.getenv("DATABASE_URL", "Not set"),
        "VIDEO_LIBRARY_DIR": os.getenv("VIDEO_LIBRARY_DIR", "Not set"),
        "DOWNLOADS_MOUNT": "Should be mounted at /Downloads"
    }
    
    return SystemInfo(
        downloads_dir_exists=downloads_exists,
        downloads_dir_readable=downloads_readable,
        downloads_dir_contents_count=contents_count,
        current_working_directory=cwd,
        environment_variables=env_vars
    )


@router.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"status": "ok", "message": "API is responding"}