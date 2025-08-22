"""
Database models for the Political Transcript Search Platform
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any, List

from .database import Base


class Video(Base):
    """Video metadata table"""
    __tablename__ = "videos"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    date: Mapped[Optional[DateTime]] = mapped_column(DateTime, index=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer)  # in seconds
    source: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    channel: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(String(500))
    video_thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    video_url: Mapped[Optional[str]] = mapped_column(String(500))
    vimeo_video_id: Mapped[Optional[str]] = mapped_column(String(50))
    vimeo_embed_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Dataset tagging
    dataset: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    source_type: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    
    # Event metadata fields
    format: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    candidate: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    place: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    record_type: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    
    # Video file fields
    video_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Local path to video file (AVI/MP4)
    srt_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)    # Local path to SRT subtitle file
    video_format: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)      # Original format: avi, mp4
    video_file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)      # File size in bytes
    video_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Duration from video metadata
    video_resolution: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # e.g., "1920x1080"
    video_fps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)            # Frames per second
    video_bitrate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)        # Bitrate in bps
    
    # Transcoding status
    transcoding_status: Mapped[Optional[str]] = mapped_column(String(20), default='pending', index=True)  # pending, processing, completed, failed
    transcoded_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Path to transcoded MP4 (for AVI files)
    transcoding_started_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    transcoding_completed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    transcoding_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # Error message if transcoding failed
    
    # Statistics (calculated fields)
    total_words: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_characters: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_segments: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    
    # Metadata
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    segments: Mapped[List["TranscriptSegment"]] = relationship("TranscriptSegment", back_populates="video", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Video(id={self.id}, title='{self.title}')>"


class Speaker(Base):
    """Speaker information table"""
    __tablename__ = "speakers"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    normalized_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    
    # Speaker metadata
    party: Mapped[Optional[str]] = mapped_column(String(50))
    title: Mapped[Optional[str]] = mapped_column(String(100))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    
    # Stats
    total_segments: Mapped[int] = mapped_column(Integer, default=0)
    total_words: Mapped[int] = mapped_column(Integer, default=0)
    avg_sentiment: Mapped[Optional[float]] = mapped_column(Float)
    
    # Relationships
    segments: Mapped[List["TranscriptSegment"]] = relationship("TranscriptSegment", back_populates="speaker")
    
    def __repr__(self):
        return f"<Speaker(id={self.id}, name='{self.name}')>"


class Topic(Base):
    """Topic classification table"""
    __tablename__ = "topics"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Stats
    total_segments: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Relationships
    segment_topics: Mapped[List["SegmentTopic"]] = relationship("SegmentTopic", back_populates="topic")
    
    def __repr__(self):
        return f"<Topic(id={self.id}, name='{self.name}')>"


class TranscriptSegment(Base):
    """Main transcript segments table"""
    __tablename__ = "transcript_segments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    segment_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # Original segment ID from HTML
    
    # Foreign keys
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"), index=True)
    speaker_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("speakers.id"), index=True)
    
    # Core transcript data
    speaker_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    speaker_party: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)  # For Tweede Kamer transcripts
    segment_type: Mapped[str] = mapped_column(String(20), default="spoken", index=True)  # "spoken" or "announcement"
    transcript_text: Mapped[str] = mapped_column(Text, nullable=False)
    video_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    timestamp_start: Mapped[Optional[str]] = mapped_column(String(20))  # e.g., "00:07:02"
    timestamp_end: Mapped[Optional[str]] = mapped_column(String(20))    # e.g., "00:07:04"
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Text metrics
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Sentiment Analysis (multiple algorithms)
    sentiment_loughran_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment_loughran_label: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment_harvard_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment_harvard_label: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment_vader_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment_vader_label: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Content Moderation (OpenAI categories)
    moderation_harassment: Mapped[Optional[float]] = mapped_column(Float)
    moderation_hate: Mapped[Optional[float]] = mapped_column(Float)
    moderation_self_harm: Mapped[Optional[float]] = mapped_column(Float)
    moderation_sexual: Mapped[Optional[float]] = mapped_column(Float)
    moderation_violence: Mapped[Optional[float]] = mapped_column(Float)
    moderation_overall_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Readability Metrics
    flesch_kincaid_grade: Mapped[Optional[float]] = mapped_column(Float)
    gunning_fog_index: Mapped[Optional[float]] = mapped_column(Float)
    coleman_liau_index: Mapped[Optional[float]] = mapped_column(Float)
    automated_readability_index: Mapped[Optional[float]] = mapped_column(Float)
    smog_index: Mapped[Optional[float]] = mapped_column(Float)
    flesch_reading_ease: Mapped[Optional[float]] = mapped_column(Float)
    
    # Stresslens Analytics
    stresslens_score: Mapped[Optional[float]] = mapped_column(Float, index=True)
    stresslens_rank: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    
    # Content Moderation Flags
    moderation_harassment_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    moderation_hate_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    moderation_violence_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    moderation_sexual_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    moderation_selfharm_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    
    # Vector Embeddings for Semantic Search
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Will store as text, converted to vector in queries
    embedding_generated_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    video: Mapped["Video"] = relationship("Video", back_populates="segments")
    speaker: Mapped[Optional["Speaker"]] = relationship("Speaker", back_populates="segments")
    segment_topics: Mapped[List["SegmentTopic"]] = relationship("SegmentTopic", back_populates="segment", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TranscriptSegment(id={self.id}, speaker='{self.speaker_name}', text='{self.transcript_text[:50]}...')>"


class SegmentTopic(Base):
    """Many-to-many relationship between segments and topics with scores"""
    __tablename__ = "segment_topics"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    segment_id: Mapped[int] = mapped_column(Integer, ForeignKey("transcript_segments.id"), index=True)
    topic_id: Mapped[int] = mapped_column(Integer, ForeignKey("topics.id"), index=True)
    
    # Topic classification scores
    score: Mapped[float] = mapped_column(Float, nullable=False)
    magnitude: Mapped[Optional[float]] = mapped_column(Float)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    
    # Relationships
    segment: Mapped["TranscriptSegment"] = relationship("TranscriptSegment", back_populates="segment_topics")
    topic: Mapped["Topic"] = relationship("Topic", back_populates="segment_topics")
    
    def __repr__(self):
        return f"<SegmentTopic(segment_id={self.segment_id}, topic_id={self.topic_id}, score={self.score})>"


class VideoSummary(Base):
    """Cached AI-generated video summaries"""
    __tablename__ = "video_summaries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"), index=True)
    
    # Summary identification
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Default Summary")
    preset_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("summary_presets.id"), nullable=True)
    
    # Summary content
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    bullet_points: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Generation parameters (for cache validation)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # openai, openrouter
    model: Mapped[str] = mapped_column(String(100), nullable=False)  # model name/id used
    custom_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Generation metadata
    summary_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    generated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    video: Mapped["Video"] = relationship("Video")
    preset: Mapped[Optional["SummaryPreset"]] = relationship("SummaryPreset")
    
    def __repr__(self):
        return f"<VideoSummary(id={self.id}, video_id={self.video_id}, name='{self.name}', provider='{self.provider}', model='{self.model}')>"


class SummaryPreset(Base):
    """Summary preset templates for custom instructions"""
    __tablename__ = "summary_presets"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Default generation parameters
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="openrouter")
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="deepseek/deepseek-chat-v3-0324:free")
    bullet_points: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Metadata
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    summaries: Mapped[List["VideoSummary"]] = relationship("VideoSummary", back_populates="preset")
    
    def __repr__(self):
        return f"<SummaryPreset(id={self.id}, name='{self.name}', is_default={self.is_default})>"


# Create database indexes for better performance
Index('idx_segment_video_speaker', TranscriptSegment.video_id, TranscriptSegment.speaker_id)
Index('idx_segment_video_seconds', TranscriptSegment.video_id, TranscriptSegment.video_seconds)
Index('idx_segment_sentiment', TranscriptSegment.sentiment_loughran_score, TranscriptSegment.sentiment_vader_score)
Index('idx_segment_moderation', TranscriptSegment.moderation_overall_score)
Index('idx_segment_readability', TranscriptSegment.flesch_kincaid_grade, TranscriptSegment.flesch_reading_ease)
Index('idx_segment_topics_score', SegmentTopic.topic_id, SegmentTopic.score)
Index('idx_video_date_source', Video.date, Video.source)
Index('idx_speaker_stats', Speaker.total_segments, Speaker.avg_sentiment)

# New indexes for event metadata and analytics
Index('idx_video_event_metadata', Video.format, Video.candidate, Video.record_type, Video.date)
Index('idx_segment_stresslens', TranscriptSegment.stresslens_score, TranscriptSegment.stresslens_rank)
Index('idx_segment_moderation_flags', TranscriptSegment.moderation_harassment_flag, TranscriptSegment.moderation_hate_flag, TranscriptSegment.moderation_violence_flag)
Index('idx_segment_analytics', TranscriptSegment.stresslens_score, TranscriptSegment.sentiment_loughran_score, TranscriptSegment.flesch_kincaid_grade)

# Indexes for semantic search embeddings
Index('idx_segment_embedding_generated', TranscriptSegment.embedding_generated_at)

# Indexes for video file fields
Index('idx_video_file_path', Video.video_file_path)
Index('idx_video_transcoding_status', Video.transcoding_status)
Index('idx_video_format', Video.video_format)
Index('idx_video_file_metadata', Video.video_format, Video.transcoding_status, Video.created_at)
