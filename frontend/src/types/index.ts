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
  
  created_at: string;
  
  // Related data
  video?: Video;
  speaker?: Speaker;
  segment_topics: SegmentTopic[];
}

export interface SearchFilters {
  speaker?: string;
  source?: string;
  topic?: string;
  date_from?: string;
  date_to?: string;
  sentiment?: string;
  min_readability?: number;
  max_readability?: number;
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
  topic?: string;
  date_from?: string;
  date_to?: string;
  sentiment?: string;
  min_readability?: number;
  max_readability?: number;
  search_type?: 'fulltext' | 'exact' | 'fuzzy';
  sort_by?: 'relevance' | 'date' | 'speaker' | 'sentiment';
  sort_order?: 'asc' | 'desc';
}

export interface Suggestion {
  value: string;
  type: 'speaker' | 'topic' | 'source';
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
  status: string;
  progress: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  current_file?: string;
  errors: string[];
  estimated_completion?: string;
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
  topic: string;
  dateFrom: string;
  dateTo: string;
  sentiment: string;
  minReadability: number | '';
  maxReadability: number | '';
  searchType: 'fulltext' | 'exact' | 'fuzzy';
  sortBy: 'relevance' | 'date' | 'speaker' | 'sentiment';
  sortOrder: 'asc' | 'desc';
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
