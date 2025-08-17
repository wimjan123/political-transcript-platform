"""
Transcript summarization service using OpenAI
"""
import os
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from ..models import Video, TranscriptSegment, VideoSummary
from ..config import settings

# Try to import OpenAI, fallback if not available
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    AsyncOpenAI = None
    HAS_OPENAI = False

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for generating AI-powered summaries of political transcripts"""
    
    def __init__(self):
        self.client = None
        self.model = "gpt-4o-mini"  # Cost-effective model for summarization
        self.max_tokens_per_summary = 500
        self.max_input_tokens = 120000  # Leave room for prompt overhead
        
    def _get_client(self, api_key: Optional[str] = None, provider: Optional[str] = None) -> AsyncOpenAI:
        """Get or create OpenAI client"""
        if not HAS_OPENAI:
            raise RuntimeError("OpenAI package not available. Please install it to use summarization features.")
        
        # Use provided API key or fall back to environment variable
        effective_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not effective_api_key:
            raise RuntimeError("API key not provided and OPENAI_API_KEY environment variable not set")
        
        # Determine base URL based on provider
        if provider == "openrouter":
            base_url = "https://openrouter.ai/api/v1"
            logger.info(f"Using OpenRouter with base URL: {base_url}")
        else:
            base_url = None  # Use OpenAI default
            logger.info("Using OpenAI with default base URL")
        
        # Create new client with the provided parameters
        logger.info(f"Creating client with provider: {provider}, has_key: {bool(effective_api_key)}")
        return AsyncOpenAI(api_key=effective_api_key, base_url=base_url)
    
    async def summarize_video_transcript(
        self, 
        db: AsyncSession, 
        video_id: int,
        bullet_points: int = 4,
        custom_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a bullet-point summary of a full video transcript
        
        Args:
            db: Database session
            video_id: ID of the video to summarize
            bullet_points: Number of bullet points to generate (3-5)
            custom_prompt: Optional custom prompt for summarization
            provider: AI provider (openai or openrouter)
            model: Model name/ID to use
            api_key: API key for the provider
            
        Returns:
            Dictionary with summary data and metadata
        """
        bullet_points = max(3, min(5, bullet_points))  # Enforce 3-5 range
        
        # Check for cached summary first
        effective_model = model or self.model
        effective_provider = provider or "openai"
        
        # Try to find existing summary with matching parameters
        cached_summary = await self._get_cached_summary(
            db, video_id, bullet_points, effective_provider, effective_model, custom_prompt
        )
        
        if cached_summary:
            logger.info(f"Returning cached summary for video {video_id}")
            return {
                "video_id": cached_summary.video_id,
                "video_title": cached_summary.video.title,
                "summary": cached_summary.summary_text,
                "bullet_points": cached_summary.bullet_points,
                "metadata": {
                    **(cached_summary.summary_metadata or {}),
                    "cached": True,
                    "generated_at": cached_summary.generated_at.isoformat(),
                    "provider_used": cached_summary.provider,
                    "model_used": cached_summary.model
                }
            }
        
        # Get video and all transcript segments
        video_query = select(Video).where(Video.id == video_id)
        video_result = await db.execute(video_query)
        video = video_result.scalar_one_or_none()
        
        if not video:
            raise ValueError(f"Video with ID {video_id} not found")
        
        # Get all segments for this video
        segments_query = (
            select(TranscriptSegment)
            .where(TranscriptSegment.video_id == video_id)
            .order_by(TranscriptSegment.video_seconds.asc().nulls_last())
        )
        segments_result = await db.execute(segments_query)
        segments = segments_result.scalars().all()
        
        if not segments:
            raise ValueError(f"No transcript segments found for video {video_id}")
        
        # Combine all transcript text
        full_transcript = self._combine_transcript_segments(segments)
        
        # Check if transcript is too long and truncate if needed
        if len(full_transcript) > self.max_input_tokens * 4:  # Rough estimate: 4 chars per token
            logger.warning(f"Transcript for video {video_id} is very long, truncating for summarization")
            full_transcript = full_transcript[:self.max_input_tokens * 4]
        
        # Generate summary using OpenAI
        try:
            summary_text = await self._generate_ai_summary(
                full_transcript, bullet_points, video, custom_prompt, provider, model, api_key
            )
        except Exception as e:
            logger.error(f"Failed to generate AI summary for video {video_id}: {str(e)}")
            # Fallback to extractive summary
            summary_text = self._generate_extractive_summary(full_transcript, bullet_points)
        
        # Calculate metadata
        total_segments = len(segments)
        total_word_count = sum(seg.word_count or 0 for seg in segments)
        total_char_count = len(full_transcript)
        
        # Get video duration
        duration_seconds = None
        if segments:
            max_seconds = max((seg.video_seconds for seg in segments if seg.video_seconds), default=None)
            if max_seconds:
                duration_seconds = max_seconds
        
        # Determine effective model used
        effective_model = model or self.model if HAS_OPENAI else "extractive"
        
        # Create metadata
        metadata = {
            "total_segments": total_segments,
            "total_words": total_word_count,
            "total_characters": total_char_count,
            "duration_seconds": duration_seconds,
            "summarization_method": "ai" if HAS_OPENAI else "extractive",
            "model_used": effective_model,
            "provider_used": provider or "openai" if HAS_OPENAI else "extractive",
            "generated_at": datetime.utcnow().isoformat(),
            "cached": False
        }
        
        # Save the summary to cache
        await self._save_summary_to_cache(
            db, video_id, summary_text, bullet_points,
            effective_provider, effective_model, custom_prompt, metadata
        )
        
        return {
            "video_id": video_id,
            "video_title": video.title,
            "summary": summary_text,
            "bullet_points": bullet_points,
            "metadata": metadata
        }
    
    def _combine_transcript_segments(self, segments: List[TranscriptSegment]) -> str:
        """Combine transcript segments into a coherent text"""
        combined_text = []
        
        for segment in segments:
            text = segment.transcript_text or ""
            speaker = segment.speaker_name or "Speaker"
            
            # Add speaker identification and text
            if text.strip():
                combined_text.append(f"{speaker}: {text.strip()}")
        
        return "\n\n".join(combined_text)
    
    async def _generate_ai_summary(
        self, 
        transcript: str, 
        bullet_points: int, 
        video: Video,
        custom_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> str:
        """Generate AI-powered summary using OpenAI or OpenRouter"""
        client = self._get_client(api_key, provider)
        
        # Use custom prompt if provided, otherwise use default
        if custom_prompt:
            prompt = f"""{custom_prompt}

Video Title: {video.title}
Date: {video.date}
Format: {video.format}

Transcript:
{transcript}

Please provide exactly {bullet_points} bullet points in this format:
• [First key point]
• [Second key point]
• [etc.]"""
        else:
            # Create default prompt for summarization
            prompt = f"""Please analyze this political transcript and provide exactly {bullet_points} key bullet points that summarize the main topics, decisions, and significant statements.

Video Title: {video.title}
Date: {video.date}
Format: {video.format}

Guidelines:
- Focus on substantive policy discussions, decisions, and key statements
- Each bullet point should be 1-2 sentences
- Prioritize concrete actions, policy positions, and significant revelations
- Avoid redundancy between bullet points
- Use clear, objective language

Transcript:
{transcript}

Please provide exactly {bullet_points} bullet points in this format:
• [First key point]
• [Second key point]
• [etc.]"""

        try:
            # Use provided model or fall back to default
            effective_model = model or self.model
            logger.info(f"Making API call with model: {effective_model}")
            
            response = await client.chat.completions.create(
                model=effective_model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert political analyst who specializes in summarizing transcripts of political speeches, debates, and hearings. You provide clear, concise, and objective summaries."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=self.max_tokens_per_summary,
                temperature=0.3  # Lower temperature for more consistent summaries
            )
            
            summary = response.choices[0].message.content.strip()
            
            # Clean up the summary if needed
            if not summary.startswith("•"):
                # Try to extract bullet points if format is different
                lines = [line.strip() for line in summary.split('\n') if line.strip()]
                bullet_lines = []
                for line in lines:
                    if any(line.startswith(prefix) for prefix in ["•", "-", "*", "1.", "2.", "3.", "4.", "5."]):
                        # Clean and standardize bullet format
                        clean_line = line.lstrip("•-*123456789. ").strip()
                        if clean_line:
                            bullet_lines.append(f"• {clean_line}")
                
                if bullet_lines:
                    summary = "\n".join(bullet_lines[:bullet_points])
            
            return summary
            
        except Exception as e:
            logger.error(f"OpenAI API error during summarization: {str(e)}")
            raise
    
    def _generate_extractive_summary(self, transcript: str, bullet_points: int) -> str:
        """Generate extractive summary as fallback when AI is not available"""
        lines = [line.strip() for line in transcript.split('\n') if line.strip()]
        
        # Simple extractive approach: take key sentences from different parts of transcript
        total_lines = len(lines)
        if total_lines == 0:
            return "• No transcript content available for summarization"
        
        # Divide transcript into sections and extract key lines
        section_size = max(1, total_lines // bullet_points)
        summary_points = []
        
        for i in range(bullet_points):
            start_idx = i * section_size
            end_idx = min(start_idx + section_size, total_lines)
            
            if start_idx < total_lines:
                # Get the longest line in this section (often contains more content)
                section_lines = lines[start_idx:end_idx]
                if section_lines:
                    longest_line = max(section_lines, key=len)
                    # Clean up speaker tags and extract main content
                    if ":" in longest_line:
                        content = longest_line.split(":", 1)[1].strip()
                    else:
                        content = longest_line.strip()
                    
                    if content and len(content) > 20:  # Skip very short lines
                        summary_points.append(f"• {content[:200]}...")  # Truncate long lines
        
        # Fill in with additional points if needed
        while len(summary_points) < bullet_points and len(summary_points) < total_lines:
            remaining_lines = [line for line in lines if not any(point[2:100] in line for point in summary_points)]
            if remaining_lines:
                line = max(remaining_lines, key=len)
                if ":" in line:
                    content = line.split(":", 1)[1].strip()
                else:
                    content = line.strip()
                if content and len(content) > 20:
                    summary_points.append(f"• {content[:200]}...")
            else:
                break
        
        if not summary_points:
            return "• No substantial content found for summarization"
        
        return "\n".join(summary_points[:bullet_points])
    
    async def batch_summarize_videos(
        self,
        db: AsyncSession,
        video_ids: List[int],
        bullet_points: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Generate summaries for multiple videos in batch
        
        Args:
            db: Database session
            video_ids: List of video IDs to summarize
            bullet_points: Number of bullet points per summary
            
        Returns:
            List of summary results
        """
        results = []
        
        for video_id in video_ids:
            try:
                summary = await self.summarize_video_transcript(db, video_id, bullet_points)
                results.append(summary)
            except Exception as e:
                logger.error(f"Failed to summarize video {video_id}: {str(e)}")
                results.append({
                    "video_id": video_id,
                    "error": str(e),
                    "summary": None
                })
        
        return results
    
    async def get_video_summary_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Get statistics about videos available for summarization"""
        
        # Count total videos
        total_videos_query = select(func.count(Video.id))
        total_result = await db.execute(total_videos_query)
        total_videos = total_result.scalar_one()
        
        # Count videos with transcript segments
        videos_with_segments_query = (
            select(func.count(func.distinct(TranscriptSegment.video_id)))
            .select_from(TranscriptSegment)
        )
        segments_result = await db.execute(videos_with_segments_query)
        videos_with_segments = segments_result.scalar_one()
        
        # Get average segment count per video using subquery
        subquery = (
            select(func.count(TranscriptSegment.id).label('seg_count'))
            .group_by(TranscriptSegment.video_id)
        ).subquery()
        
        avg_segments_query = select(func.avg(subquery.c.seg_count))
        avg_result = await db.execute(avg_segments_query)
        avg_segments = avg_result.scalar_one() or 0
        
        return {
            "total_videos": total_videos,
            "videos_with_transcripts": videos_with_segments,
            "average_segments_per_video": round(float(avg_segments), 1),
            "summarization_available": HAS_OPENAI,
            "model_used": self.model if HAS_OPENAI else "extractive"
        }
    
    async def _get_cached_summary(
        self,
        db: AsyncSession,
        video_id: int,
        bullet_points: int,
        provider: str,
        model: str,
        custom_prompt: Optional[str] = None
    ) -> Optional[VideoSummary]:
        """Check for existing cached summary with matching parameters"""
        
        query = (
            select(VideoSummary)
            .where(
                and_(
                    VideoSummary.video_id == video_id,
                    VideoSummary.bullet_points == bullet_points,
                    VideoSummary.provider == provider,
                    VideoSummary.model == model,
                    VideoSummary.custom_prompt == custom_prompt
                )
            )
            .options(selectinload(VideoSummary.video))
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def _save_summary_to_cache(
        self,
        db: AsyncSession,
        video_id: int,
        summary_text: str,
        bullet_points: int,
        provider: str,
        model: str,
        custom_prompt: Optional[str],
        metadata: Dict[str, Any]
    ) -> VideoSummary:
        """Save generated summary to cache"""
        
        # First, delete any existing summary for this video (one summary per video for now)
        existing_query = select(VideoSummary).where(VideoSummary.video_id == video_id)
        existing_result = await db.execute(existing_query)
        existing_summary = existing_result.scalar_one_or_none()
        
        if existing_summary:
            await db.delete(existing_summary)
        
        # Create new summary record
        video_summary = VideoSummary(
            video_id=video_id,
            summary_text=summary_text,
            bullet_points=bullet_points,
            provider=provider,
            model=model,
            custom_prompt=custom_prompt,
            summary_metadata=metadata,
            generated_at=datetime.utcnow()
        )
        
        db.add(video_summary)
        await db.commit()
        await db.refresh(video_summary)
        
        logger.info(f"Saved summary to cache for video {video_id}")
        return video_summary


# Global summarization service instance
summarization_service = SummarizationService()