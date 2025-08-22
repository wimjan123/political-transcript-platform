"""
Video file import service with SRT subtitle parsing

Handles discovery and import of AVI/MP4 video files with their corresponding SRT subtitle files.
"""

import os
import glob
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import ffmpeg
import pysrt
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models import Video, TranscriptSegment, Speaker
from ..database import get_db
# from .analytics_service import AnalyticsService

logger = logging.getLogger(__name__)


class VideoImportService:
    """Service for importing video files and parsing SRT subtitles"""
    
    def __init__(self, video_directory: str):
        """
        Initialize video import service
        
        Args:
            video_directory: Directory to scan for video files
        """
        self.video_directory = video_directory
        # self.analytics_service = AnalyticsService()
        self.supported_formats = {'.avi', '.mp4', '.mkv', '.mov'}
    
    def discover_video_files(self, directories: Optional[List[str]] = None) -> List[Dict[str, str]]:
        """
        Discover video files and their corresponding SRT files
        
        Args:
            directories: Specific directories to search (if None, uses self.video_directory)
        
        Returns:
            List of dictionaries containing video_path and srt_path (if exists)
        """
        video_files = []
        
        # Use specific directories if provided, otherwise default directory
        search_directories = directories if directories else [self.video_directory]
        
        for directory in search_directories:
            if not os.path.exists(directory):
                logger.warning(f"Video directory does not exist: {directory}")
                continue
            
            video_files.extend(self._discover_videos_in_directory(directory))
        
        logger.info(f"Discovered {len(video_files)} video files")
        return video_files
    
    def _discover_videos_in_directory(self, directory: str) -> List[Dict[str, str]]:
        """
        Discover video files in a specific directory
        
        Args:
            directory: Directory to search
            
        Returns:
            List of video file information dictionaries
        """
        video_files = []
        
        for ext in self.supported_formats:
            pattern = os.path.join(directory, f"**/*{ext}")
            for video_path in glob.glob(pattern, recursive=True):
                # Look for corresponding SRT file
                base_path = os.path.splitext(video_path)[0]
                srt_path = f"{base_path}.srt"
                
                video_files.append({
                    'video_path': video_path,
                    'srt_path': srt_path if os.path.exists(srt_path) else None,
                    'filename': os.path.basename(video_path),
                    'size': os.path.getsize(video_path)
                })
        
        return video_files
    
    def get_video_metadata(self, video_path: str) -> Dict:
        """
        Extract video metadata using FFmpeg
        
        Args:
            video_path: Path to video file
            
        Returns:
            Dictionary containing video metadata
        """
        try:
            probe = ffmpeg.probe(video_path)
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            
            if not video_stream:
                raise ValueError("No video stream found")
            
            metadata = {
                'duration_seconds': float(probe.get('format', {}).get('duration', 0)),
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'fps': eval(video_stream.get('r_frame_rate', '0/1')),  # Convert fraction to float
                'bitrate': int(probe.get('format', {}).get('bit_rate', 0)),
                'format_name': probe.get('format', {}).get('format_name', ''),
                'codec': video_stream.get('codec_name', '')
            }
            
            metadata['resolution'] = f"{metadata['width']}x{metadata['height']}"
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to extract metadata from {video_path}: {str(e)}")
            return {}
    
    def parse_srt_file(self, srt_path: str) -> List[Dict]:
        """
        Parse SRT subtitle file and extract segments
        
        Args:
            srt_path: Path to SRT file
            
        Returns:
            List of subtitle segments with timing and text
        """
        if not srt_path or not os.path.exists(srt_path):
            return []
        
        try:
            subs = pysrt.open(srt_path, encoding='utf-8')
            segments = []
            
            for i, subtitle in enumerate(subs):
                # Convert pysrt time objects to seconds
                start_seconds = (subtitle.start.hours * 3600 + 
                               subtitle.start.minutes * 60 + 
                               subtitle.start.seconds + 
                               subtitle.start.milliseconds / 1000.0)
                
                end_seconds = (subtitle.end.hours * 3600 + 
                             subtitle.end.minutes * 60 + 
                             subtitle.end.seconds + 
                             subtitle.end.milliseconds / 1000.0)
                
                # Clean subtitle text (remove HTML tags and extra whitespace)
                text = subtitle.text.replace('<br>', ' ').replace('<br/>', ' ')
                text = ' '.join(text.split())  # Remove extra whitespace
                
                segments.append({
                    'segment_id': f"srt_{i+1}",
                    'start_seconds': start_seconds,
                    'end_seconds': end_seconds,
                    'duration_seconds': end_seconds - start_seconds,
                    'text': text,
                    'timestamp_start': str(subtitle.start).split(',')[0],  # Remove milliseconds
                    'timestamp_end': str(subtitle.end).split(',')[0]
                })
            
            logger.info(f"Parsed {len(segments)} subtitle segments from {srt_path}")
            return segments
            
        except Exception as e:
            logger.error(f"Failed to parse SRT file {srt_path}: {str(e)}")
            return []
    
    def extract_speaker_from_subtitle(self, text: str) -> Tuple[str, str]:
        """
        Extract speaker name from subtitle text if present
        
        Args:
            text: Subtitle text
            
        Returns:
            Tuple of (speaker_name, cleaned_text)
        """
        # Common patterns for speaker identification in subtitles
        patterns = [
            r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):(.+)$',  # "John Smith: Hello there"
            r'^([A-Z\s]+):(.+)$',  # "JOHN: Hello there"
            r'^\[([^\]]+)\]:?(.+)$',  # "[John Smith] Hello there"
            r'^\(([^)]+)\):?(.+)$',  # "(John Smith) Hello there"
        ]
        
        import re
        for pattern in patterns:
            match = re.match(pattern, text.strip())
            if match:
                speaker_name = match.group(1).strip()
                cleaned_text = match.group(2).strip()
                return speaker_name, cleaned_text
        
        # No speaker identified, use "Unknown Speaker"
        return "Unknown Speaker", text
    
    def import_video_file(self, video_info: Dict, db: Session) -> Optional[Video]:
        """
        Import a single video file with its SRT subtitles
        
        Args:
            video_info: Video file information from discover_video_files
            db: Database session
            
        Returns:
            Created Video instance or None if failed
        """
        try:
            video_path = video_info['video_path']
            srt_path = video_info.get('srt_path')
            filename = video_info['filename']
            
            # Check if video already exists
            existing_video = db.query(Video).filter(
                or_(
                    Video.video_file_path == video_path,
                    Video.filename == filename
                )
            ).first()
            
            if existing_video:
                logger.info(f"Video already imported: {filename}")
                return existing_video
            
            # Get video metadata
            metadata = self.get_video_metadata(video_path)
            if not metadata:
                logger.warning(f"Could not extract metadata from {video_path}")
                return None
            
            # Create video record
            video = Video(
                title=os.path.splitext(filename)[0],  # Use filename without extension as title
                filename=filename,
                video_file_path=video_path,
                srt_file_path=srt_path,
                video_format=os.path.splitext(filename)[1][1:].lower(),  # Remove dot from extension
                video_file_size=video_info['size'],
                video_duration_seconds=metadata.get('duration_seconds'),
                video_resolution=metadata.get('resolution'),
                video_fps=metadata.get('fps'),
                video_bitrate=metadata.get('bitrate'),
                dataset='video_library',
                source_type='video_file',
                transcoding_status='pending' if video_info.get('video_format') == 'avi' else 'completed'
            )
            
            db.add(video)
            db.flush()  # Get the ID
            
            # Parse and import SRT subtitles
            if srt_path:
                segments_data = self.parse_srt_file(srt_path)
                self._import_subtitle_segments(video.id, segments_data, db)
            
            db.commit()
            logger.info(f"Successfully imported video: {filename}")
            return video
            
        except Exception as e:
            logger.error(f"Failed to import video {video_info['filename']}: {str(e)}")
            db.rollback()
            return None
    
    def _import_subtitle_segments(self, video_id: int, segments_data: List[Dict], db: Session):
        """Import subtitle segments to database"""
        
        for segment_data in segments_data:
            # Extract speaker information
            speaker_name, cleaned_text = self.extract_speaker_from_subtitle(segment_data['text'])
            
            # Get or create speaker
            speaker = db.query(Speaker).filter(Speaker.name == speaker_name).first()
            if not speaker:
                speaker = Speaker(
                    name=speaker_name,
                    normalized_name=speaker_name.lower().strip()
                )
                db.add(speaker)
                db.flush()
            
            # Calculate text metrics
            word_count = len(cleaned_text.split())
            char_count = len(cleaned_text)
            
            # Create transcript segment
            segment = TranscriptSegment(
                segment_id=segment_data['segment_id'],
                video_id=video_id,
                speaker_id=speaker.id,
                speaker_name=speaker_name,
                transcript_text=cleaned_text,
                video_seconds=int(segment_data['start_seconds']),
                timestamp_start=segment_data['timestamp_start'],
                timestamp_end=segment_data['timestamp_end'],
                duration_seconds=int(segment_data['duration_seconds']),
                word_count=word_count,
                char_count=char_count
            )
            
            # Add analytics if service is available
            # Note: Analytics service temporarily disabled to avoid import issues
            # try:
            #     analytics_data = self.analytics_service.analyze_text(cleaned_text)
            #     if analytics_data:
            #         # Add sentiment scores
            #         segment.sentiment_vader_score = analytics_data.get('sentiment', {}).get('vader', {}).get('compound')
            #         segment.sentiment_vader_label = analytics_data.get('sentiment', {}).get('vader', {}).get('label')
            #         
            #         # Add readability metrics
            #         readability = analytics_data.get('readability', {})
            #         segment.flesch_kincaid_grade = readability.get('flesch_kincaid_grade')
            #         segment.flesch_reading_ease = readability.get('flesch_reading_ease')
            #         segment.gunning_fog_index = readability.get('gunning_fog_index')
            # except Exception as e:
            #     logger.warning(f"Could not add analytics to segment: {str(e)}")
            
            db.add(segment)
        
        logger.info(f"Imported {len(segments_data)} subtitle segments for video {video_id}")
    
    def import_all_videos(self, force_reimport: bool = False) -> Dict[str, int]:
        """
        Import all video files from the directory
        
        Args:
            force_reimport: Whether to reimport existing videos
            
        Returns:
            Dictionary with import statistics
        """
        stats = {
            'discovered': 0,
            'imported': 0,
            'skipped': 0,
            'errors': 0
        }
        
        # Discover video files
        video_files = self.discover_video_files()
        stats['discovered'] = len(video_files)
        
        # Import each video
        with next(get_db()) as db:
            for video_info in video_files:
                try:
                    if force_reimport:
                        # Remove existing video first
                        existing = db.query(Video).filter(
                            Video.video_file_path == video_info['video_path']
                        ).first()
                        if existing:
                            db.delete(existing)
                            db.commit()
                    
                    result = self.import_video_file(video_info, db)
                    if result:
                        stats['imported'] += 1
                    else:
                        stats['errors'] += 1
                        
                except Exception as e:
                    logger.error(f"Error importing {video_info['filename']}: {str(e)}")
                    stats['errors'] += 1
        
        stats['skipped'] = stats['discovered'] - stats['imported'] - stats['errors']
        
        logger.info(f"Video import completed. Stats: {stats}")
        return stats
    
    def import_from_folders(self, folder_paths: List[str], force_reimport: bool = False) -> Dict[str, int]:
        """
        Import video files from specific folders
        
        Args:
            folder_paths: List of folder paths to import from
            force_reimport: Whether to reimport existing videos
            
        Returns:
            Dictionary with import statistics
        """
        stats = {
            'discovered': 0,
            'imported': 0,
            'skipped': 0,
            'errors': 0
        }
        
        # Discover video files in selected folders
        video_files = self.discover_video_files(folder_paths)
        stats['discovered'] = len(video_files)
        
        # Import each video
        with next(get_db()) as db:
            for video_info in video_files:
                try:
                    if force_reimport:
                        # Remove existing video first
                        existing = db.query(Video).filter(
                            Video.video_file_path == video_info['video_path']
                        ).first()
                        if existing:
                            db.delete(existing)
                            db.commit()
                    
                    result = self.import_video_file(video_info, db)
                    if result:
                        stats['imported'] += 1
                    else:
                        stats['errors'] += 1
                        
                except Exception as e:
                    logger.error(f"Error importing {video_info['filename']}: {str(e)}")
                    stats['errors'] += 1
        
        stats['skipped'] = stats['discovered'] - stats['imported'] - stats['errors']
        
        logger.info(f"Folder import completed. Stats: {stats}")
        return stats


def get_video_import_service(video_directory: str = None) -> VideoImportService:
    """Factory function to create VideoImportService"""
    if not video_directory:
        # Default to Downloads directory since it's mounted from BunkrDownloader
        video_directory = os.getenv('VIDEO_LIBRARY_DIR', '/Downloads')
    
    return VideoImportService(video_directory)