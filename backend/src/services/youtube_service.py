"""
YouTube video processing and transcription service
"""
import os
import json
import logging
import tempfile
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
import re

HAS_YTDLP = False
HAS_MOVIEPY = False
HAS_OPENAI = False

try:
    import yt_dlp  # type: ignore
    HAS_YTDLP = True
except Exception as e:
    logging.warning(f"Missing yt-dlp for YouTube service: {e}")

try:
    from moviepy.editor import VideoFileClip  # type: ignore
    HAS_MOVIEPY = True
except Exception as e:
    logging.warning(f"MoviePy not available; will skip audio conversion to WAV: {e}")

try:
    from openai import OpenAI  # type: ignore
    HAS_OPENAI = True
except Exception as e:
    logging.warning(f"OpenAI client not available: {e}")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import Video, Speaker, TranscriptSegment, Topic, SegmentTopic
from ..config import settings

logger = logging.getLogger(__name__)

class YouTubeService:
    """Service for processing YouTube videos and generating transcripts"""
    
    def __init__(self):
        self.openai_client = None
        
    def set_openai_api_key(self, api_key: str):
        """Set OpenAI API key for transcription"""
        if api_key:
            self.openai_client = OpenAI(api_key=api_key)
            
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    async def get_video_info(self, url: str) -> Dict[str, Any]:
        """Get video metadata from YouTube"""
        if not HAS_YTDLP:
            raise RuntimeError("Required dependency not installed: yt-dlp")
            
        video_id = self.extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")
            
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
            # Extract relevant metadata
            metadata = {
                'video_id': video_id,
                'title': info.get('title', ''),
                'description': info.get('description', ''),
                'duration': info.get('duration', 0),
                'upload_date': info.get('upload_date'),
                'uploader': info.get('uploader', ''),
                'channel': info.get('channel', ''),
                'thumbnail': info.get('thumbnail', ''),
                'view_count': info.get('view_count', 0),
                'like_count': info.get('like_count', 0),
                'tags': info.get('tags', []),
                'url': url,
            }
            
            # Convert upload_date to proper format
            if metadata['upload_date']:
                try:
                    date_str = metadata['upload_date']
                    metadata['formatted_date'] = datetime.strptime(date_str, '%Y%m%d').date()
                except ValueError:
                    metadata['formatted_date'] = None
            else:
                metadata['formatted_date'] = None
                
            return metadata
            
        except Exception as e:
            logger.error(f"Error extracting video info: {str(e)}")
            raise RuntimeError(f"Failed to extract video information: {str(e)}")
    
    async def download_audio(self, url: str, output_path: str) -> str:
        """Download audio from YouTube video"""
        if not HAS_YTDLP:
            raise RuntimeError("Required dependency not installed: yt-dlp")
            
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            # Prefer returning original bestaudio file (OpenAI supports many formats)
            audio_file = output_path
            if '%(ext)s' in audio_file:
                # If template remained, yt-dlp probably filled it; derive actual file name
                # yt-dlp will replace %(ext)s with actual extension; try common extensions
                for ext in ('.m4a', '.webm', '.mp3', '.opus'):
                    candidate = output_path.replace('.%(ext)s', ext)
                    if os.path.exists(candidate):
                        audio_file = candidate
                        break
            # If MoviePy is available and file is not WAV and you prefer WAV, convert; otherwise skip
            if HAS_MOVIEPY and not audio_file.endswith('.wav'):
                try:
                    wav_file = os.path.splitext(audio_file)[0] + '.wav'
                    with VideoFileClip(audio_file) as video:
                        video.audio.write_audiofile(wav_file, verbose=False, logger=None)
                    os.remove(audio_file)
                    audio_file = wav_file
                except Exception as e:
                    logger.warning(f"Audio conversion skipped due to error: {e}")

            return audio_file
            
        except Exception as e:
            logger.error(f"Error downloading audio: {str(e)}")
            raise RuntimeError(f"Failed to download audio: {str(e)}")
    
    async def transcribe_audio(self, audio_file: str, api_key: str) -> Dict[str, Any]:
        """Transcribe audio using OpenAI Whisper API"""
        if not api_key:
            raise ValueError("OpenAI API key required for transcription")
        if not HAS_OPENAI:
            raise RuntimeError("OpenAI client library not installed")
        self.set_openai_api_key(api_key)
        
        # Check file size (OpenAI limit is 25MB)
        file_size = os.path.getsize(audio_file)
        if file_size > 25 * 1024 * 1024:  # 25MB
            raise ValueError("Audio file too large (>25MB). Consider splitting the video.")
            
        try:
            with open(audio_file, 'rb') as audio:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )
                
            return transcript.model_dump()
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            raise RuntimeError(f"Transcription failed: {str(e)}")
    
    async def process_transcript_segments(
        self, 
        transcript: Dict[str, Any], 
        video_info: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Process transcript segments into database format"""
        segments = []
        
        for i, segment in enumerate(transcript.get('segments', [])):
            # Create segment data
            segment_data = {
                'segment_id': str(i + 1),
                'speaker_name': video_info.get('uploader', 'Unknown'),  # Use uploader as speaker
                'transcript_text': segment.get('text', '').strip(),
                'video_seconds': int(segment.get('start', 0)),
                'timestamp_start': self._seconds_to_timestamp(segment.get('start', 0)),
                'timestamp_end': self._seconds_to_timestamp(segment.get('end', 0)),
                'duration_seconds': int(segment.get('end', 0) - segment.get('start', 0)),
                'word_count': len(segment.get('text', '').split()),
                'char_count': len(segment.get('text', '')),
            }
            
            segments.append(segment_data)
            
        return segments
    
    def _seconds_to_timestamp(self, seconds: float) -> str:
        """Convert seconds to HH:MM:SS format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    async def save_to_database(
        self, 
        db: AsyncSession, 
        video_info: Dict[str, Any], 
        segments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Save video and transcript segments to database"""
        try:
            # Create video record
            video = Video(
                title=video_info['title'],
                filename=f"youtube-{video_info['video_id']}.json",
                date=video_info.get('formatted_date'),
                duration=video_info.get('duration'),
                source="YouTube",
                channel=video_info.get('channel', ''),
                description=video_info.get('description', ''),
                url=video_info['url'],
                video_thumbnail_url=video_info.get('thumbnail', ''),
                video_url=video_info['url'],
                format="Video",
                candidate="",
                place="",
                record_type="Video Upload",
            )
            
            db.add(video)
            await db.flush()  # Get video ID
            
            # Create or get speaker
            speaker_query = select(Speaker).where(
                Speaker.normalized_name == video_info.get('uploader', 'unknown').lower().replace(' ', '_')
            )
            speaker_result = await db.execute(speaker_query)
            speaker = speaker_result.scalar_one_or_none()
            
            if not speaker:
                speaker = Speaker(
                    name=video_info.get('uploader', 'Unknown'),
                    normalized_name=video_info.get('uploader', 'unknown').lower().replace(' ', '_')
                )
                db.add(speaker)
                await db.flush()
            
            # Create transcript segments
            transcript_segments = []
            for segment_data in segments:
                segment = TranscriptSegment(
                    video_id=video.id,
                    speaker_id=speaker.id,
                    segment_id=segment_data['segment_id'],
                    speaker_name=segment_data['speaker_name'],
                    transcript_text=segment_data['transcript_text'],
                    video_seconds=segment_data['video_seconds'],
                    timestamp_start=segment_data['timestamp_start'],
                    timestamp_end=segment_data['timestamp_end'],
                    duration_seconds=segment_data['duration_seconds'],
                    word_count=segment_data['word_count'],
                    char_count=segment_data['char_count'],
                )
                
                transcript_segments.append(segment)
            
            db.add_all(transcript_segments)
            await db.commit()
            
            return {
                'video_id': video.id,
                'total_segments': len(transcript_segments),
                'total_duration': video_info.get('duration', 0),
                'title': video.title,
            }
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error saving to database: {str(e)}")
            raise RuntimeError(f"Failed to save to database: {str(e)}")
    
    async def process_youtube_video(
        self, 
        db: AsyncSession,
        url: str, 
        openai_api_key: str,
        progress_callback=None
    ) -> Dict[str, Any]:
        """Complete pipeline to process a YouTube video"""
        if not HAS_YTDLP:
            raise RuntimeError("Required dependency not installed: yt-dlp")
            
        temp_dir = None
        audio_file = None
        
        try:
            # Step 1: Get video info
            if progress_callback:
                await progress_callback("Extracting video information...")
            video_info = await self.get_video_info(url)
            
            # Step 2: Download audio
            if progress_callback:
                await progress_callback("Downloading audio...")
            temp_dir = tempfile.mkdtemp()
            audio_path = os.path.join(temp_dir, f"audio_{video_info['video_id']}.%(ext)s")
            audio_file = await self.download_audio(url, audio_path)
            
            # Step 3: Transcribe
            if progress_callback:
                await progress_callback("Transcribing audio with OpenAI Whisper...")
            transcript = await self.transcribe_audio(audio_file, openai_api_key)
            
            # Step 4: Process segments
            if progress_callback:
                await progress_callback("Processing transcript segments...")
            segments = await self.process_transcript_segments(transcript, video_info)
            
            # Step 5: Save to database
            if progress_callback:
                await progress_callback("Saving to database...")
            result = await self.save_to_database(db, video_info, segments)
            
            if progress_callback:
                await progress_callback("Complete!")
                
            return result
            
        finally:
            # Cleanup
            if audio_file and os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except Exception as e:
                    logger.warning(f"Could not remove audio file: {e}")
                    
            if temp_dir and os.path.exists(temp_dir):
                try:
                    os.rmdir(temp_dir)
                except Exception as e:
                    logger.warning(f"Could not remove temp directory: {e}")

# Global service instance
youtube_service = YouTubeService()
