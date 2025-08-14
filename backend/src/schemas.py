"""
Pydantic schemas for the Political Transcript Search Platform
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class VideoResponse(BaseModel):
    """Video metadata response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    title: str
    filename: str
    date: Optional[date]
    duration: Optional[int]
    source: Optional[str]
    channel: Optional[str]
    description: Optional[str]
    url: Optional[str]
    created_at: datetime


class SpeakerResponse(BaseModel):
    """Speaker response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    normalized_name: str
    party: Optional[str]
    title: Optional[str]
    bio: Optional[str]
    total_segments: int
    total_words: int
    avg_sentiment: Optional[float]


class TopicResponse(BaseModel):
    """Topic response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    code: Optional[str]
    category: Optional[str]
    description: Optional[str]
    total_segments: int
    avg_score: Optional[float]


class SegmentTopicResponse(BaseModel):
    """Segment topic relationship response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    topic: TopicResponse
    score: float
    magnitude: Optional[float]
    confidence: Optional[float]


class TranscriptSegmentResponse(BaseModel):
    """Transcript segment response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    segment_id: str
    speaker_name: str
    transcript_text: str
    video_seconds: int
    timestamp_start: Optional[str]
    timestamp_end: Optional[str]
    duration_seconds: Optional[int]
    word_count: int
    char_count: int
    
    # Sentiment Analysis
    sentiment_loughran_score: Optional[float]
    sentiment_loughran_label: Optional[str]
    sentiment_harvard_score: Optional[float]
    sentiment_harvard_label: Optional[str]
    sentiment_vader_score: Optional[float]
    sentiment_vader_label: Optional[str]
    
    # Content Moderation
    moderation_harassment: Optional[float]
    moderation_hate: Optional[float]
    moderation_self_harm: Optional[float]
    moderation_sexual: Optional[float]
    moderation_violence: Optional[float]
    moderation_overall_score: Optional[float]
    
    # Readability Metrics
    flesch_kincaid_grade: Optional[float]
    gunning_fog_index: Optional[float]
    coleman_liau_index: Optional[float]
    automated_readability_index: Optional[float]
    smog_index: Optional[float]
    flesch_reading_ease: Optional[float]
    
    created_at: datetime
    
    # Related data
    video: Optional[VideoResponse]
    speaker: Optional[SpeakerResponse]
    segment_topics: List[SegmentTopicResponse] = []


class SearchFilters(BaseModel):
    """Search filters schema"""
    speaker: Optional[str] = None
    source: Optional[str] = None
    topic: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    sentiment: Optional[str] = None
    min_readability: Optional[float] = None
    max_readability: Optional[float] = None


class SearchResponse(BaseModel):
    """Search response schema"""
    results: List[TranscriptSegmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    query: str
    filters: SearchFilters


class AnalyticsStatsResponse(BaseModel):
    """Analytics statistics response schema"""
    total_videos: int
    total_segments: int
    total_speakers: int
    total_topics: int
    date_range: Dict[str, Optional[date]]
    top_speakers: List[Dict[str, Any]]
    top_topics: List[Dict[str, Any]]
    sentiment_distribution: Dict[str, int]


class SentimentAnalyticsResponse(BaseModel):
    """Sentiment analytics response schema"""
    by_speaker: List[Dict[str, Any]]
    by_topic: List[Dict[str, Any]]
    by_date: List[Dict[str, Any]]
    distribution: Dict[str, int]
    average_scores: Dict[str, float]


class TopicAnalyticsResponse(BaseModel):
    """Topic analytics response schema"""
    topic_distribution: List[Dict[str, Any]]
    topic_trends: List[Dict[str, Any]]
    speaker_topics: List[Dict[str, Any]]
    topic_sentiment: List[Dict[str, Any]]


class ReadabilityAnalyticsResponse(BaseModel):
    """Readability analytics response schema"""
    by_speaker: List[Dict[str, Any]]
    by_source: List[Dict[str, Any]]
    distribution: Dict[str, int]
    average_scores: Dict[str, float]
    trends: List[Dict[str, Any]]


class ContentModerationAnalyticsResponse(BaseModel):
    """Content moderation analytics response schema"""
    by_category: List[Dict[str, Any]]
    by_speaker: List[Dict[str, Any]]
    by_source: List[Dict[str, Any]]
    high_risk_segments: List[TranscriptSegmentResponse]
    trends: List[Dict[str, Any]]


class VideoCreateRequest(BaseModel):
    """Video creation request schema"""
    title: str
    filename: str
    date: Optional[date] = None
    duration: Optional[int] = None
    source: Optional[str] = None
    channel: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


class VideoUpdateRequest(BaseModel):
    """Video update request schema"""
    title: Optional[str] = None
    date: Optional[date] = None
    duration: Optional[int] = None
    source: Optional[str] = None
    channel: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


class SpeakerCreateRequest(BaseModel):
    """Speaker creation request schema"""
    name: str
    party: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None


class TopicCreateRequest(BaseModel):
    """Topic creation request schema"""
    name: str
    code: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class ImportStatusResponse(BaseModel):
    """Import status response schema"""
    status: str
    progress: float
    total_files: int
    processed_files: int
    failed_files: int
    current_file: Optional[str]
    errors: List[str]
    estimated_completion: Optional[datetime]