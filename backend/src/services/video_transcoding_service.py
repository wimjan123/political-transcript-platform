"""
Video transcoding service using FFmpeg

Handles conversion of video files (primarily AVI to MP4) for web compatibility.
"""

import os
import asyncio
import ffmpeg
from datetime import datetime
from typing import Optional, Dict, Any
import logging
from sqlalchemy.orm import Session
from pathlib import Path

from ..models import Video
from ..database import get_db

logger = logging.getLogger(__name__)


class VideoTranscodingService:
    """Service for transcoding video files using FFmpeg"""
    
    def __init__(self, output_directory: str = None):
        """
        Initialize transcoding service
        
        Args:
            output_directory: Directory to store transcoded files
        """
        self.output_directory = output_directory or os.getenv('TRANSCODED_VIDEO_DIR', '/root/video_library/transcoded')
        os.makedirs(self.output_directory, exist_ok=True)
        
        # Default transcoding settings for web compatibility
        self.web_settings = {
            'vcodec': 'libx264',     # H.264 codec for wide compatibility
            'acodec': 'aac',         # AAC audio codec
            'preset': 'medium',      # Balance between speed and compression
            'crf': 23,               # Constant rate factor (quality)
            'pix_fmt': 'yuv420p',    # Pixel format for web compatibility
            'movflags': 'faststart', # Optimize for web streaming
            'max_muxing_queue_size': 9999  # Handle large files
        }
    
    def should_transcode(self, video_format: str) -> bool:
        """
        Determine if a video format needs transcoding
        
        Args:
            video_format: Original video format (e.g., 'avi', 'mp4')
            
        Returns:
            True if transcoding is needed
        """
        # MP4 files generally don't need transcoding
        # AVI, MOV, MKV files should be transcoded for web compatibility
        needs_transcoding = video_format.lower() in ['avi', 'mov', 'mkv', 'wmv', 'flv']
        return needs_transcoding
    
    def get_transcoded_filename(self, original_path: str) -> str:
        """
        Generate filename for transcoded video
        
        Args:
            original_path: Path to original video file
            
        Returns:
            Filename for transcoded version
        """
        original_name = Path(original_path).stem
        return f"{original_name}_transcoded.mp4"
    
    def get_transcoded_path(self, original_path: str) -> str:
        """
        Generate full path for transcoded video
        
        Args:
            original_path: Path to original video file
            
        Returns:
            Full path for transcoded version
        """
        transcoded_filename = self.get_transcoded_filename(original_path)
        return os.path.join(self.output_directory, transcoded_filename)
    
    def transcode_video(self, input_path: str, output_path: str, settings: Dict[str, Any] = None) -> bool:
        """
        Transcode video file using FFmpeg
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            settings: FFmpeg settings (uses defaults if None)
            
        Returns:
            True if transcoding was successful
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file does not exist: {input_path}")
            return False
        
        # Use default settings if none provided
        if settings is None:
            settings = self.web_settings.copy()
        
        try:
            logger.info(f"Starting transcoding: {input_path} -> {output_path}")
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Build FFmpeg stream
            stream = ffmpeg.input(input_path)
            stream = ffmpeg.output(stream, output_path, **settings)
            
            # Run transcoding with overwrite
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info(f"Transcoding completed successfully: {output_path}")
                return True
            else:
                logger.error(f"Transcoding failed - output file not created or empty: {output_path}")
                return False
                
        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error during transcoding: {e.stderr.decode() if e.stderr else str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during transcoding: {str(e)}")
            return False
    
    def transcode_video_async(self, input_path: str, output_path: str, settings: Dict[str, Any] = None) -> bool:
        """
        Transcode video asynchronously (runs in background)
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            settings: FFmpeg settings (uses defaults if None)
            
        Returns:
            True if transcoding process started successfully
        """
        try:
            # Use default settings if none provided
            if settings is None:
                settings = self.web_settings.copy()
            
            logger.info(f"Starting async transcoding: {input_path} -> {output_path}")
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Build FFmpeg stream
            stream = ffmpeg.input(input_path)
            stream = ffmpeg.output(stream, output_path, **settings)
            
            # Run transcoding asynchronously
            process = ffmpeg.run_async(stream, overwrite_output=True, quiet=True)
            
            logger.info(f"Async transcoding process started for: {input_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start async transcoding: {str(e)}")
            return False
    
    def update_video_transcoding_status(self, video_id: int, status: str, error: str = None, transcoded_path: str = None):
        """
        Update transcoding status in database
        
        Args:
            video_id: Video ID
            status: New status ('processing', 'completed', 'failed')
            error: Error message if failed
            transcoded_path: Path to transcoded file if completed
        """
        try:
            with next(get_db()) as db:
                video = db.query(Video).filter(Video.id == video_id).first()
                if video:
                    video.transcoding_status = status
                    
                    if status == 'processing':
                        video.transcoding_started_at = datetime.utcnow()
                    elif status in ['completed', 'failed']:
                        video.transcoding_completed_at = datetime.utcnow()
                    
                    if error:
                        video.transcoding_error = error
                    
                    if transcoded_path:
                        video.transcoded_file_path = transcoded_path
                    
                    db.commit()
                    logger.info(f"Updated transcoding status for video {video_id}: {status}")
                
        except Exception as e:
            logger.error(f"Failed to update transcoding status for video {video_id}: {str(e)}")
    
    def transcode_video_by_id(self, video_id: int) -> bool:
        """
        Transcode video by database ID
        
        Args:
            video_id: Video ID from database
            
        Returns:
            True if transcoding was successful
        """
        try:
            with next(get_db()) as db:
                video = db.query(Video).filter(Video.id == video_id).first()
                if not video:
                    logger.error(f"Video not found: {video_id}")
                    return False
                
                if not video.video_file_path or not os.path.exists(video.video_file_path):
                    logger.error(f"Video file not found: {video.video_file_path}")
                    self.update_video_transcoding_status(video_id, 'failed', 'Video file not found')
                    return False
                
                # Check if transcoding is needed
                if not self.should_transcode(video.video_format or ''):
                    logger.info(f"Video {video_id} doesn't need transcoding (format: {video.video_format})")
                    self.update_video_transcoding_status(video_id, 'completed')
                    return True
                
                # Update status to processing
                self.update_video_transcoding_status(video_id, 'processing')
                
                # Generate output path
                output_path = self.get_transcoded_path(video.video_file_path)
                
                # Perform transcoding
                success = self.transcode_video(video.video_file_path, output_path)
                
                if success:
                    self.update_video_transcoding_status(video_id, 'completed', transcoded_path=output_path)
                    logger.info(f"Successfully transcoded video {video_id}")
                else:
                    self.update_video_transcoding_status(video_id, 'failed', 'Transcoding process failed')
                    logger.error(f"Failed to transcode video {video_id}")
                
                return success
                
        except Exception as e:
            logger.error(f"Error transcoding video {video_id}: {str(e)}")
            self.update_video_transcoding_status(video_id, 'failed', str(e))
            return False
    
    def transcode_all_pending_videos(self) -> Dict[str, int]:
        """
        Transcode all videos with pending status
        
        Returns:
            Dictionary with transcoding statistics
        """
        stats = {
            'pending': 0,
            'processed': 0,
            'successful': 0,
            'failed': 0
        }
        
        try:
            with next(get_db()) as db:
                # Get all videos that need transcoding
                pending_videos = db.query(Video).filter(
                    Video.transcoding_status == 'pending',
                    Video.video_file_path.isnot(None)
                ).all()
                
                stats['pending'] = len(pending_videos)
                
                for video in pending_videos:
                    stats['processed'] += 1
                    logger.info(f"Processing video {video.id}: {video.filename}")
                    
                    try:
                        success = self.transcode_video_by_id(video.id)
                        if success:
                            stats['successful'] += 1
                        else:
                            stats['failed'] += 1
                    except Exception as e:
                        logger.error(f"Error processing video {video.id}: {str(e)}")
                        stats['failed'] += 1
                
                logger.info(f"Transcoding batch completed. Stats: {stats}")
                
        except Exception as e:
            logger.error(f"Error in batch transcoding: {str(e)}")
        
        return stats
    
    def get_video_playback_path(self, video_id: int) -> Optional[str]:
        """
        Get the appropriate video path for playback
        
        Args:
            video_id: Video ID
            
        Returns:
            Path to video file for playback (transcoded if available, original otherwise)
        """
        try:
            with next(get_db()) as db:
                video = db.query(Video).filter(Video.id == video_id).first()
                if not video:
                    return None
                
                # Prefer transcoded file if available and transcoding is completed
                if (video.transcoding_status == 'completed' and 
                    video.transcoded_file_path and 
                    os.path.exists(video.transcoded_file_path)):
                    return video.transcoded_file_path
                
                # Fall back to original file
                if video.video_file_path and os.path.exists(video.video_file_path):
                    return video.video_file_path
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting playback path for video {video_id}: {str(e)}")
            return None


def get_transcoding_service() -> VideoTranscodingService:
    """Factory function to create VideoTranscodingService"""
    return VideoTranscodingService()