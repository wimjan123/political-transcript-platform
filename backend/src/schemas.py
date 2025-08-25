"""
Pydantic schemas for the Political Transcript Search Platform
"""
from pydantic import BaseModel, ConfigDict, Field
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
    video_thumbnail_url: Optional[str]
    video_url: Optional[str]
    vimeo_video_id: Optional[str]
    vimeo_embed_url: Optional[str]
    
    # Dataset
    dataset: Optional[str]
    source_type: Optional[str]
    
    # Event metadata fields
    format: Optional[str]
    candidate: Optional[str]
    place: Optional[str]
    record_type: Optional[str]

    # Representative speaker (optional): used by the frontend video list to show primary speaker / party
    primary_speaker_name: Optional[str] = None
    primary_speaker_party: Optional[str] = None
    
    total_words: Optional[int]
    total_characters: Optional[int]
    total_segments: Optional[int]
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
    speaker_party: Optional[str] = None
    transcript_text: str
    video_seconds: Optional[int]
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
    
    # Stresslens Analytics
    stresslens_score: Optional[float]
    stresslens_rank: Optional[int]
    
    # Emotion Analysis
    emotion_label: Optional[str]
    emotion_intensity: Optional[int]
    heat_score: Optional[float]
    heat_components: Optional[Dict[str, Any]]
    
    # Content Moderation Flags
    moderation_harassment_flag: Optional[bool]
    moderation_hate_flag: Optional[bool]
    moderation_violence_flag: Optional[bool]
    moderation_sexual_flag: Optional[bool]
    moderation_selfharm_flag: Optional[bool]
    
    created_at: datetime
    
    # Related data
    video: Optional[VideoResponse]
    speaker: Optional[SpeakerResponse]
    segment_topics: List[SegmentTopicResponse] = []


class SearchFilters(BaseModel):
    """Search filters schema"""
    speaker: Optional[str] = None
    source: Optional[str] = None
    dataset: Optional[str] = None
    topic: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    sentiment: Optional[str] = None
    min_readability: Optional[float] = None
    max_readability: Optional[float] = None
    
    # Event metadata filters
    format: Optional[str] = None
    candidate: Optional[str] = None
    place: Optional[str] = None
    record_type: Optional[str] = None
    
    # Stresslens filters
    min_stresslens: Optional[float] = None
    max_stresslens: Optional[float] = None
    stresslens_rank: Optional[int] = None
    
    # Moderation flags filters
    has_harassment: Optional[bool] = None
    has_hate: Optional[bool] = None
    has_violence: Optional[bool] = None
    has_sexual: Optional[bool] = None
    has_selfharm: Optional[bool] = None


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


class DashboardAnalyticsResponse(BaseModel):
    """Unified dashboard analytics response schema"""
    kpi_stats: AnalyticsStatsResponse
    sentiment_over_time: List[Dict[str, Any]]
    topic_distribution: List[Dict[str, Any]]
    speaker_activity: List[Dict[str, Any]]
    sentiment_by_speaker: List[Dict[str, Any]]
    content_moderation_summary: List[Dict[str, Any]]
    readability_metrics: Dict[str, Any]


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
    job_type: Optional[str] = None
    status: str
    progress: float
    total_files: int
    processed_files: int
    failed_files: int
    current_file: Optional[str]
    errors: List[str]
    estimated_completion: Optional[datetime]


class SummaryPresetResponse(BaseModel):
    """Summary preset response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    description: Optional[str]
    custom_prompt: str
    provider: str
    model: str
    bullet_points: int
    is_default: bool
    created_at: datetime
    updated_at: datetime


class SummaryPresetCreateRequest(BaseModel):
    """Summary preset creation request schema"""
    name: str
    description: Optional[str] = None
    custom_prompt: str
    provider: str = "openrouter"
    model: str = "deepseek/deepseek-chat-v3-0324:free"
    bullet_points: int = 4
    is_default: bool = False


class SummaryPresetUpdateRequest(BaseModel):
    """Summary preset update request schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    custom_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    bullet_points: Optional[int] = None
    is_default: Optional[bool] = None


class VideoSummaryResponse(BaseModel):
    """Video summary response schema"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    video_id: int
    name: str
    preset_id: Optional[int]
    summary_text: str
    bullet_points: int
    provider: str
    model: str
    custom_prompt: Optional[str]
    summary_metadata: Optional[Dict[str, Any]]
    generated_at: datetime
    created_at: datetime
    updated_at: datetime
    
    # Related data
    preset: Optional[SummaryPresetResponse] = None


class VideoSummaryCreateRequest(BaseModel):
    """Video summary creation request schema"""
    video_id: int
    name: str = "Default Summary"
    preset_id: Optional[int] = None
    custom_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    bullet_points: Optional[int] = None


# Segments API Schemas
class SegmentOut(BaseModel):
    """Simplified segment output schema for the segments API"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    video_id: int
    segment_id: str
    speaker_name: str
    speaker_party: Optional[str]
    transcript_text: str
    timestamp_start: Optional[str]
    timestamp_end: Optional[str]
    video_seconds: Optional[int]
    word_count: int
    char_count: int
    
    # Sentiment Analysis (with aliases for consistency)
    sentiment_vader_score: Optional[float] = Field(None, alias="sentiment_vader")
    sentiment_harvard_score: Optional[float] = Field(None, alias="sentiment_harvard_iv")
    sentiment_loughran_score: Optional[float] = Field(None, alias="sentiment_loughran_mcdonald")
    
    # Emotion Analysis
    emotion_label: Optional[str]
    emotion_intensity: Optional[int]
    heat_score: Optional[float]
    heat_components: Optional[Dict[str, Any]]
    
    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class SegmentsPage(BaseModel):
    """Paginated segments response schema"""
    data: List[SegmentOut]
    pagination: Dict[str, Any]
    message: str = "Success"
    status_code: int = 200


# Emotions Ingest Schemas
class EmotionItemIn(BaseModel):
    """Single emotion item for batch ingest"""
    segment_id: int
    emotion_label: str
    emotion_intensity: int = Field(ge=0, le=100, description="Emotion intensity from 0-100")
    heat_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Heat score from 0.0-1.0")
    heat_components: Optional[Dict[str, Any]] = Field(None, description="JSON breakdown of heat components")


class EmotionsIngestRequest(BaseModel):
    """Batch emotions ingest request schema"""
    items: List[EmotionItemIn] = Field(..., min_items=1, max_items=10000, description="Batch of emotion items")


class EmotionsIngestResult(BaseModel):
    """Emotions ingest result schema"""
    updated: int
    errors: List[Dict[str, Any]] = []
    message: str = "Success"
    status_code: int = 200
