// API Response Types
export interface Video {
  id: number;
  title: string;
  filename: string;
  date?: string;
  duration?: number;
  source?: string;
  channel?: string;
  description?: string;
  url?: string;
  video_thumbnail_url?: string;
  video_url?: string;
  vimeo_video_id?: string;
  vimeo_embed_url?: string;
  
  // Event metadata fields
  format?: string;
  candidate?: string;
  place?: string;
  record_type?: string;
  
  // Dataset tagging
  dataset?: string;
  source_type?: string;
  
  created_at: string;
}

export interface Speaker {
  id: number;
  name: string;
  normalized_name: string;
  party?: string;
  title?: string;
  bio?: string;
  total_segments: number;
  total_words: number;
  avg_sentiment?: number;
}

export interface Topic {
  id: number;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  total_segments: number;
  avg_score?: number;
}

export interface SegmentTopic {
  topic: Topic;
  score: number;
  magnitude?: number;
  confidence?: number;
}

export interface TranscriptSegment {
  id: number;
  segment_id: string;
  speaker_name: string;
  speaker_party?: string;
  segment_type?: string;
  transcript_text: string;
  video_seconds: number;
  timestamp_start?: string;
  timestamp_end?: string;
  duration_seconds?: number;
  word_count: number;
  char_count: number;
  
  // Sentiment Analysis
  sentiment_loughran_score?: number | null;
  sentiment_loughran_label?: string;
  sentiment_harvard_score?: number | null;
  sentiment_harvard_label?: string;
  sentiment_vader_score?: number | null;
  sentiment_vader_label?: string;
  
  // Content Moderation
  moderation_harassment?: number | null;
  moderation_hate?: number | null;
  moderation_self_harm?: number | null;
  moderation_sexual?: number | null;
  moderation_violence?: number | null;
  moderation_overall_score?: number | null;
  
  // Readability Metrics
  flesch_kincaid_grade?: number | null;
  gunning_fog_index?: number | null;
  coleman_liau_index?: number | null;
  automated_readability_index?: number | null;
  smog_index?: number | null;
  flesch_reading_ease?: number | null;
  
  // Stresslens Analytics
  stresslens_score?: number | null;
  stresslens_rank?: number | null;
  
  // Content Moderation Flags
  moderation_harassment_flag?: boolean;
  moderation_hate_flag?: boolean;
  moderation_violence_flag?: boolean;
  moderation_sexual_flag?: boolean;
  moderation_selfharm_flag?: boolean;
  
  // Semantic Search
  similarity_score?: number;
  
  created_at: string;
  
  // Related data
  video?: Video;
  speaker?: Speaker;
  segment_topics: SegmentTopic[];
}

export interface SearchFilters {
  speaker?: string;
  source?: string;
  dataset?: string;
  topic?: string;
  date_from?: string;
  date_to?: string;
  sentiment?: string;
  min_readability?: number;
  max_readability?: number;
  
  // Event metadata filters
  format?: string;
  candidate?: string;
  place?: string;
  record_type?: string;
  
  // Stresslens filters
  min_stresslens?: number;
  max_stresslens?: number;
  stresslens_rank?: number;
  
  // Moderation flags filters
  has_harassment?: boolean;
  has_hate?: boolean;
  has_violence?: boolean;
  has_sexual?: boolean;
  has_selfharm?: boolean;
  
  // Video file filters
  has_video_file?: boolean;
  video_format?: string;
  transcoding_status?: string;
  has_subtitles?: boolean;
}

export interface SearchResponse {
  results: TranscriptSegment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  query: string;
  filters: SearchFilters;
}

export interface SearchParams {
  q: string;
  page?: number;
  page_size?: number;
  speaker?: string;
  source?: string;
  dataset?: string;
  topic?: string;
  date_from?: string;
  date_to?: string;
  sentiment?: string;
  min_readability?: number;
  max_readability?: number;
  
  // Event metadata filters
  format?: string;
  candidate?: string;
  place?: string;
  record_type?: string;
  
  // Stresslens filters
  min_stresslens?: number;
  max_stresslens?: number;
  stresslens_rank?: number;
  
  // Moderation flags filters
  has_harassment?: boolean;
  has_hate?: boolean;
  has_violence?: boolean;
  has_sexual?: boolean;
  has_selfharm?: boolean;
  
  search_type?: 'fulltext' | 'exact' | 'fuzzy' | 'semantic';
  sort_by?: 'relevance' | 'date' | 'speaker' | 'sentiment' | 'stresslens' | 'similarity';
  sort_order?: 'asc' | 'desc';
  
  // Semantic search specific
  similarity_threshold?: number;
}

export interface Suggestion {
  value: string;
  type: 'speaker' | 'topic' | 'source' | 'format' | 'candidate' | 'place' | 'record_type';
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
}

// Analytics Types
export interface AnalyticsStats {
  total_videos: number;
  total_segments: number;
  total_speakers: number;
  total_topics: number;
  date_range: {
    min_date?: string;
    max_date?: string;
  };
  top_speakers: Array<{
    name: string;
    segment_count: number;
    avg_sentiment: number;
  }>;
  top_topics: Array<{
    name: string;
    frequency: number;
    avg_score: number;
  }>;
  sentiment_distribution: Record<string, number>;
}

export interface SentimentAnalytics {
  by_speaker: Array<{
    speaker: string;
    avg_sentiment: number;
    segment_count: number;
    sentiment_stddev?: number;
  }>;
  by_topic: Array<{
    topic: string;
    avg_sentiment: number;
    segment_count: number;
  }>;
  by_date: Array<{
    date: string;
    avg_sentiment: number;
    segment_count: number;
  }>;
  distribution: Record<string, number>;
  average_scores: Record<string, number>;
}

export interface TopicAnalytics {
  topic_distribution: Array<{
    topic: string;
    category?: string;
    frequency: number;
    avg_score: number;
    max_score: number;
  }>;
  topic_trends: Array<{
    date: string;
    topic: string;
    frequency: number;
    avg_score: number;
  }>;
  speaker_topics: Array<{
    speaker: string;
    topic: string;
    frequency: number;
    avg_score: number;
  }>;
  topic_sentiment: Array<{
    topic: string;
    avg_sentiment: number;
    segment_count: number;
    avg_topic_score: number;
  }>;
}

// New Dashboard Analytics Types
export interface DashboardAnalytics {
  kpi_stats: AnalyticsStats;
  sentiment_over_time: Array<{
    date: string;
    sentiment: number;
    count: number;
  }>;
  topic_distribution: Array<{
    topic: string;
    count: number;
    percentage?: number;
  }>;
  speaker_activity: Array<{
    speaker: string;
    segments: number;
    words: number;
  }>;
  sentiment_by_speaker: Array<{
    speaker: string;
    sentiment: number;
    segments: number;
  }>;
  content_moderation_summary: Array<{
    category: string;
    avg_score?: number;
    count?: number;
  }>;
  readability_metrics: {
    avg_grade_level: number;
    avg_reading_ease: number;
    avg_fog_index: number;
  };
}

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  speakers: string[];
  topics: string[];
}

export interface ReadabilityAnalytics {
  by_speaker: Array<{
    speaker: string;
    avg_fk_grade: number;
    avg_reading_ease: number;
    avg_fog_index: number;
    segment_count: number;
  }>;
  by_source: Array<{
    source: string;
    avg_fk_grade: number;
    avg_reading_ease: number;
    segment_count: number;
  }>;
  distribution: Record<string, number>;
  average_scores: Record<string, number>;
  trends: Array<{
    date: string;
    avg_fk_grade: number;
    avg_reading_ease: number;
    segment_count: number;
  }>;
}

export interface ContentModerationAnalytics {
  by_category: Array<{
    category: string;
    avg_score: number;
  }>;
  by_speaker: Array<{
    speaker: string;
    avg_score: number;
    segment_count: number;
  }>;
  by_source: Array<{
    source: string;
    avg_score: number;
    segment_count: number;
  }>;
  high_risk_segments: TranscriptSegment[];
  trends: Array<{
    date: string;
    avg_score: number;
    segment_count: number;
  }>;
}

// Video Statistics
export interface VideoStats {
  video_id: number;
  total_segments: number;
  total_words: number;
  avg_sentiment: number;
  avg_readability: number;
  duration_seconds: number;
  speaker_stats: Array<{
    speaker: string;
    segment_count: number;
    total_words: number;
    avg_sentiment: number;
  }>;
  sentiment_distribution: Record<string, number>;
}

// Import Types
export interface ImportStatus {
  job_type?: string;
  status: string;
  progress: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  current_file?: string;
  errors: string[];
  estimated_completion?: string;
}

// Embedding Types
export interface EmbeddingStatus {
  total_segments: number;
  segments_with_embeddings: number;
  segments_without_embeddings: number;
  completion_percentage: number;
  latest_generation_time?: string;
  embedding_model: string;
  embedding_dimensions: number;
}

// Ingest Types
export interface YouTubeVideoInfo {
  video_id: string;
  title: string;
  duration: number;
  uploader: string;
  channel: string;
  thumbnail: string;
  upload_date?: string;
  view_count: number;
}

export interface YouTubeIngestRequest {
  url: string;
  openai_api_key: string;
  title_override?: string;
  speaker_override?: string;
}

export interface IngestStatus {
  status: 'processing' | 'completed' | 'error';
  progress: string;
  video_id?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
  result?: {
    video_id: number;
    total_segments: number;
    total_duration: number;
    title: string;
  };
}

export interface OpenAIKeyTestResult {
  valid: boolean;
  whisper_available: boolean;
  message: string;
}

// Database Status Types
export interface DatabaseStatus {
  import_status: ImportStatus;
  database_stats: {
    total_videos: number;
    total_segments: number;
    total_speakers: number;
    total_topics: number;
    storage_size?: string;
    last_import?: string;
  };
}

// UI State Types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterState {
  speaker: string;
  source: string;
  dataset: string;
  topic: string;
  dateFrom: string;
  dateTo: string;
  sentiment: string;
  minReadability: number | '';
  maxReadability: number | '';
  
  // Event metadata filters
  format: string;
  candidate: string;
  place: string;
  recordType: string;
  
  // Stresslens filters
  minStresslens: number | '';
  maxStresslens: number | '';
  stresslensRank: number | '';
  
  // Moderation flags
  hasHarassment: boolean;
  hasHate: boolean;
  hasViolence: boolean;
  hasSexual: boolean;
  hasSelfharm: boolean;
  
  // Video file filters
  hasVideoFile: boolean | '';
  videoFormat: string;
  transcodingStatus: string;
  hasSubtitles: boolean | '';
  
  searchType: 'fulltext' | 'exact' | 'fuzzy' | 'semantic';
  sortBy: 'relevance' | 'date' | 'speaker' | 'sentiment' | 'stresslens' | 'similarity';
  sortOrder: 'asc' | 'desc';
  
  // Semantic search specific
  similarityThreshold: number | '';
}

// Chart data types for analytics
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins?: {
    legend?: {
      display: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    title?: {
      display: boolean;
      text: string;
    };
    tooltip?: {
      mode?: 'index' | 'point' | 'nearest';
      intersect?: boolean;
    };
  };
  scales?: {
    x?: {
      display: boolean;
      title?: {
        display: boolean;
        text: string;
      };
    };
    y?: {
      display: boolean;
      title?: {
        display: boolean;
        text: string;
      };
      beginAtZero?: boolean;
    };
  };
  interaction?: {
    mode?: 'index' | 'point' | 'nearest';
    intersect?: boolean;
  };
}

// AI Summarization Types
export type AIProvider = 'openai' | 'openrouter';

export interface SummaryRequest {
  video_id: number;
  summary_length?: 'short' | 'medium' | 'long';
  summary_format?: 'bullet_points' | 'paragraph';
  custom_prompt?: string;
  provider?: AIProvider;
  model?: string;
  api_key?: string;
}

export interface SummaryResponse {
  video_id: number;
  video_title: string;
  summary: string;
  bullet_points: number;
  metadata: Record<string, any>;
}

export interface SummaryStats {
  total_videos: number;
  videos_with_transcripts: number;
  average_segments_per_video: number;
  summarization_available: boolean;
  model_used: string;
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customModel: string; // For manual OpenRouter model entry
  defaultSummaryLength: 'short' | 'medium' | 'long';
  defaultSummaryFormat: 'bullet_points' | 'paragraph';
  defaultCustomPrompt: string;
  // Enhanced customization options
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  customBulletPoints?: number;
  includeTimestamps?: boolean;
  includeSpeakers?: boolean;
  focusAreas?: string[];
  excludeAreas?: string[];
  tone?: 'neutral' | 'formal' | 'casual' | 'analytical' | 'journalistic';
  perspective?: 'objective' | 'critical' | 'supportive' | 'balanced';
  detailLevel?: 'high' | 'medium' | 'low';
  language?: string;
}

export interface AIPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<AISettings>;
  isBuiltIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  contextLength?: number;
  description?: string;
}
