import axios from 'axios';
import type {
  SearchResponse,
  SearchParams,
  SuggestionsResponse,
  AnalyticsStats,
  SentimentAnalytics,
  TopicAnalytics,
  ReadabilityAnalytics,
  ContentModerationAnalytics,
  DashboardAnalytics,
  DashboardFilters,
  Video,
  VideoStats,
  TranscriptSegment,
  ImportStatus,
  SummaryResponse,
  SummaryStats,
  SummaryRequest,
  AIProvider
} from '@/types';

// Determine API base URL
// - If REACT_APP_API_URL is set, use it.
// - For Docker development, browser connects to host-exposed port
// - Empty string uses proxy (which is broken)
const inferBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl !== undefined && envUrl !== '') return envUrl;
  // Browser connects to backend via host network (port exposed as 8000)
  return 'http://localhost:8000';
};

const API_BASE_URL = inferBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Helper function to ensure segment_topics is always an array
const transformSegmentResponse = (segment: any): TranscriptSegment => {
  return {
    ...segment,
    segment_topics: Array.isArray(segment.segment_topics) ? segment.segment_topics : [],
    video: segment.video || undefined,
    speaker: segment.speaker || undefined,
  };
};

// Helper function to transform search response
const transformSearchResponse = (response: SearchResponse): SearchResponse => {
  return {
    ...response,
    results: response.results.map(transformSegmentResponse)
  };
};

// Search API
export const searchAPI = {
  // Search transcripts
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const response = await api.get('/api/search/', { params });
    return transformSearchResponse(response.data);
  },

  // Get search suggestions
  getSuggestions: async (
    query: string,
    type: string = 'all',
    limit: number = 10
  ): Promise<SuggestionsResponse> => {
    const response = await api.get('/api/search/suggest', {
      params: { q: query, type, limit },
    });
    return response.data;
  },

  // Export search results
  exportResults: async (params: SearchParams, format: 'csv' | 'json' = 'csv'): Promise<Blob> => {
    const response = await api.get('/api/search/export', {
      params: { ...params, format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Semantic search
  semanticSearch: async (params: SearchParams & { similarity_threshold?: number }): Promise<SearchResponse> => {
    const response = await api.get('/api/search/semantic', { params });
    return transformSearchResponse(response.data);
  },

  // Meilisearch endpoint (lexical, hybrid, semantic)
  searchMeili: async (
    params: {
      q: string;
      page?: number;
      page_size?: number;
      mode?: 'lexical' | 'hybrid' | 'semantic';
      index?: 'segments' | 'events';
      locales?: string[];
    } & Record<string, any>
  ): Promise<SearchResponse> => {
    const response = await api.get('/api/search/meili', { params });
    return transformSearchResponse(response.data);
  },

  // Generate embeddings
  generateEmbeddings: async (forceRegenerate: boolean = false, batchSize: number = 100): Promise<any> => {
    const response = await api.post('/api/search/generate-embeddings', null, {
      params: { force_regenerate: forceRegenerate, batch_size: batchSize },
    });
    return response.data;
  },

  // Get embedding status
  getEmbeddingStatus: async (): Promise<any> => {
    const response = await api.get('/api/search/embedding-status');
    return response.data;
  },

  // Find similar segments
  findSimilarSegments: async (
    segmentId: number,
    limit: number = 10,
    index: 'segments' | 'events' = 'segments'
  ): Promise<SearchResponse> => {
    const response = await api.get(`/api/search/meili/similar_segments/${segmentId}`, {
      params: { limit, index },
    });
    return transformSearchResponse(response.data);
  },

  // Unified search with dual engine support
  unifiedSearch: async (params: SearchParams & { engine?: string }): Promise<SearchResponse> => {
    const response = await api.get('/api/search/', { params });
    return transformSearchResponse(response.data);
  },

  // Get search engine status
  getEngineStatus: async (): Promise<{
    primary_engine: string;
    fallback_engine: string;
    engines: {
      [key: string]: {
        healthy: boolean;
        url?: string;
        cluster_status?: string;
        nodes?: number;
        error?: string;
      };
    };
  }> => {
    const response = await api.get('/api/search/status');
    return response.data;
  },

  // Compare search engines
  compareEngines: async (query: string, size: number = 10): Promise<{
    query: string;
    elasticsearch: any;
    meilisearch: any;
    comparison_summary: {
      es_total: number;
      meili_total: number;
      es_took: number;
      meili_took: number;
    };
  }> => {
    const response = await api.get('/api/search/compare', {
      params: { q: query, size }
    });
    return response.data;
  },

  // Switch primary search engine
  switchPrimaryEngine: async (engine: 'elasticsearch' | 'meilisearch'): Promise<{
    message: string;
    primary_engine: string;
    fallback_engine: string;
  }> => {
    const response = await api.post('/api/search/switch-primary', null, {
      params: { engine }
    });
    return response.data;
  },

  // Reindex search engines
  reindexEngines: async (
    engine: 'elasticsearch' | 'meilisearch' | 'all' = 'all',
    batchSize: number = 500
  ): Promise<any> => {
    const response = await api.post('/api/search/reindex', null, {
      params: { engine, batch_size: batchSize }
    });
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  // Get unified dashboard analytics
  getDashboardAnalytics: async (filters: Partial<DashboardFilters>): Promise<DashboardAnalytics> => {
    const params: Record<string, any> = {};
    
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.speakers && filters.speakers.length > 0) {
      params.speakers = filters.speakers.join(',');
    }
    if (filters.topics && filters.topics.length > 0) {
      params.topics = filters.topics.join(',');
    }
    
    const response = await api.get('/api/analytics/dashboard', { params });
    return response.data;
  },

  // Get overall stats
  getStats: async (dateFrom?: string, dateTo?: string): Promise<AnalyticsStats> => {
    const response = await api.get('/api/analytics/stats', {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },

  // Get sentiment analytics
  getSentimentAnalytics: async (
    dateFrom?: string,
    dateTo?: string,
    speaker?: string,
    topic?: string
  ): Promise<SentimentAnalytics> => {
    const response = await api.get('/api/analytics/sentiment', {
      params: { date_from: dateFrom, date_to: dateTo, speaker, topic },
    });
    return response.data;
  },

  // Get topic analytics
  getTopicAnalytics: async (
    dateFrom?: string,
    dateTo?: string,
    speaker?: string
  ): Promise<TopicAnalytics> => {
    const response = await api.get('/api/analytics/topics', {
      params: { date_from: dateFrom, date_to: dateTo, speaker },
    });
    return response.data;
  },

  // Get readability analytics
  getReadabilityAnalytics: async (
    dateFrom?: string,
    dateTo?: string
  ): Promise<ReadabilityAnalytics> => {
    const response = await api.get('/api/analytics/readability', {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },

  // Get content moderation analytics
  getModerationAnalytics: async (
    dateFrom?: string,
    dateTo?: string,
    threshold: number = 0.5
  ): Promise<ContentModerationAnalytics> => {
    const response = await api.get('/api/analytics/moderation', {
      params: { date_from: dateFrom, date_to: dateTo, threshold },
    });
    return response.data;
  },
};

// Videos API
export const videosAPI = {
  // Get videos list
  getVideos: async (
    page: number = 1,
    pageSize: number = 25,
    filters?: {
      source?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<Video[]> => {
    const response = await api.get('/api/videos/', {
      params: { page, page_size: pageSize, ...filters },
    });
    return response.data;
  },

  // Get video by ID
  getVideo: async (videoId: number): Promise<Video> => {
    const response = await api.get(`/api/videos/${videoId}`);
    return response.data;
  },

  // Get video segments
  getVideoSegments: async (
    videoId: number,
    page: number = 1,
    pageSize: number = 50,
    speaker?: string,
    q?: string
  ): Promise<TranscriptSegment[]> => {
    const response = await api.get(`/api/videos/${videoId}/segments`, {
      params: { page, page_size: pageSize, speaker, q },
    });
    return response.data;
  },

  // Get video statistics
  getVideoStats: async (videoId: number): Promise<VideoStats> => {
    const response = await api.get(`/api/videos/${videoId}/stats`);
    return response.data;
  },

  // Create video
  createVideo: async (videoData: Omit<Video, 'id' | 'created_at'>): Promise<Video> => {
    const response = await api.post('/api/videos/', videoData);
    return response.data;
  },

  // Update video
  updateVideo: async (videoId: number, videoData: Partial<Video>): Promise<Video> => {
    const response = await api.put(`/api/videos/${videoId}`, videoData);
    return response.data;
  },

  // Delete video
  deleteVideo: async (videoId: number): Promise<void> => {
    await api.delete(`/api/videos/${videoId}`);
  },
  
  // Download a single clip (mp4)
  downloadClip: async (
    videoId: number,
    startSeconds: number,
    durationSeconds: number,
    sourceUrl?: string
  ): Promise<Blob> => {
    const response = await api.post(
      `/api/videos/${videoId}/clip`,
      { start_seconds: startSeconds, duration_seconds: durationSeconds, source_url: sourceUrl },
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Download multiple clips as a zip
  downloadClipsZip: async (
    videoId: number,
    items: Array<{ start_seconds: number; duration_seconds: number; label?: string }>,
    sourceUrl?: string
  ): Promise<Blob> => {
    const response = await api.post(
      `/api/videos/${videoId}/clips.zip`,
      { items, source_url: sourceUrl },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// Upload/Import API
export const uploadAPI = {
  // Start HTML import
  startHtmlImport: async (
    sourceDir?: string,
    forceReimport: boolean = false
  ): Promise<{ message: string; status: string; source_directory: string }> => {
    const response = await api.post('/api/upload/import-html', null, {
      params: { source_dir: sourceDir, force_reimport: forceReimport },
    });
    return response.data;
  },

  // Start Tweede Kamer VLOS XML import
  startVlosXmlImport: async (
    sourceDir?: string,
    forceReimport: boolean = false
  ): Promise<{ message: string; status: string; source_directory: string }> => {
    const response = await api.post('/api/upload/import-vlos-xml', null, {
      params: { source_dir: sourceDir, force_reimport: forceReimport },
    });
    return response.data;
  },

  // Get import status
  getImportStatus: async (): Promise<ImportStatus> => {
    const response = await api.get('/api/upload/import-status');
    return response.data;
  },

  // Cancel import
  cancelImport: async (): Promise<{ message: string }> => {
    const response = await api.post('/api/upload/import-cancel');
    return response.data;
  },

  // Import single file
  importFile: async (
    filePath: string,
    forceReimport: boolean = false
  ): Promise<{ message: string; file_path: string; result: any }> => {
    const response = await api.post('/api/upload/import-file', null, {
      params: { file_path: filePath, force_reimport: forceReimport },
    });
    return response.data;
  },

  // Get import statistics
  getImportStats: async (): Promise<{
    total_videos: number;
    total_segments: number;
    total_speakers: number;
    total_topics: number;
    recent_imports: Array<{
      id: number;
      title: string;
      filename: string;
      imported_at: string;
    }>;
  }> => {
    const response = await api.get('/api/upload/import-stats');
    return response.data;
  },

  // Clear all data
  clearAllData: async (confirm: boolean = true): Promise<{ message: string }> => {
    const response = await api.delete('/api/upload/clear-data', {
      params: { confirm },
    });
    return response.data;
  },

  // Clear a specific dataset (e.g., 'tweede_kamer')
  clearDataset: async (dataset: string, confirm: boolean = true): Promise<{ message: string }> => {
    const response = await api.delete('/api/upload/clear-dataset', {
      params: { dataset, confirm },
    });
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async (): Promise<{ status: string; message: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Utility functions
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
};

// Helper function to extract time from ISO datetime strings
export const extractTimeFromISO = (isoString: string): string => {
  if (!isoString) return '';
  
  try {
    // Extract time portion from ISO string (YYYY-MM-DDTHH:MM:SS format)
    const timeMatch = isoString.match(/T(\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      return timeMatch[1];
    }
    
    // Fallback: try to extract time from any HH:MM:SS pattern
    const timePattern = isoString.match(/(\d{2}:\d{2}:\d{2})/);
    if (timePattern) {
      return timePattern[1];
    }
    
    return isoString;
  } catch (e) {
    return isoString;
  }
};

// Format timestamp range from start and end ISO strings
export const formatTimestampRange = (startISO?: string, endISO?: string): string => {
  if (!startISO && !endISO) return '';
  
  const startTime = startISO ? extractTimeFromISO(startISO) : '';
  const endTime = endISO ? extractTimeFromISO(endISO) : '';
  
  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  } else if (startTime) {
    return startTime;
  } else if (endTime) {
    return endTime;
  }
  
  return '';
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getSentimentColor = (score?: number | null): string => {
  if (score === undefined || score === null) return 'text-gray-500 dark:text-gray-400';
  if (score > 0.1) return 'text-green-600 dark:text-green-400';
  if (score < -0.1) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-300';
};

export const getSentimentLabel = (score?: number | null): string => {
  if (score === undefined || score === null) return 'Unknown';
  if (score > 0.1) return 'Positive';
  if (score < -0.1) return 'Negative';
  return 'Neutral';
};

export const getReadabilityGrade = (score?: number): string => {
  if (score === undefined || score === null) return 'Unknown';
  if (score <= 6) return 'Elementary';
  if (score <= 9) return 'Middle School';
  if (score <= 12) return 'High School';
  return 'College';
};

export const getEmotionColor = (emotion?: string | null): string => {
  if (!emotion) return 'text-gray-500 dark:text-gray-400';
  
  const emotionColors: { [key: string]: string } = {
    // Positive emotions
    'joy': 'text-yellow-600 dark:text-yellow-400',
    'happy': 'text-yellow-600 dark:text-yellow-400',
    'excitement': 'text-orange-500 dark:text-orange-400',
    'hope': 'text-blue-500 dark:text-blue-400',
    'optimistic': 'text-green-500 dark:text-green-400',
    'confident': 'text-indigo-600 dark:text-indigo-400',
    
    // Negative emotions
    'anger': 'text-red-600 dark:text-red-400',
    'angry': 'text-red-600 dark:text-red-400',
    'rage': 'text-red-700 dark:text-red-500',
    'fear': 'text-purple-600 dark:text-purple-400',
    'worried': 'text-purple-500 dark:text-purple-400',
    'sadness': 'text-blue-700 dark:text-blue-500',
    'sad': 'text-blue-700 dark:text-blue-500',
    'frustrated': 'text-orange-700 dark:text-orange-500',
    'disappointed': 'text-gray-600 dark:text-gray-400',
    'concerned': 'text-amber-600 dark:text-amber-400',
    
    // Neutral emotions
    'neutral': 'text-gray-600 dark:text-gray-300',
    'calm': 'text-blue-400 dark:text-blue-300',
    'serious': 'text-gray-700 dark:text-gray-200',
    'determined': 'text-indigo-700 dark:text-indigo-300'
  };
  
  const normalizedEmotion = emotion.toLowerCase();
  return emotionColors[normalizedEmotion] || 'text-gray-600 dark:text-gray-300';
};

export const getEmotionBgColor = (emotion?: string | null): string => {
  if (!emotion) return 'bg-gray-100 text-gray-800';
  
  const emotionBgColors: { [key: string]: string } = {
    // Positive emotions
    'joy': 'bg-yellow-100 text-yellow-800',
    'happy': 'bg-yellow-100 text-yellow-800',
    'excitement': 'bg-orange-100 text-orange-800',
    'hope': 'bg-blue-100 text-blue-800',
    'optimistic': 'bg-green-100 text-green-800',
    'confident': 'bg-indigo-100 text-indigo-800',
    
    // Negative emotions
    'anger': 'bg-red-100 text-red-800',
    'angry': 'bg-red-100 text-red-800',
    'rage': 'bg-red-200 text-red-900',
    'fear': 'bg-purple-100 text-purple-800',
    'worried': 'bg-purple-100 text-purple-800',
    'sadness': 'bg-blue-100 text-blue-800',
    'sad': 'bg-blue-100 text-blue-800',
    'frustrated': 'bg-orange-100 text-orange-800',
    'disappointed': 'bg-gray-100 text-gray-800',
    'concerned': 'bg-amber-100 text-amber-800',
    
    // Neutral emotions
    'neutral': 'bg-gray-100 text-gray-800',
    'calm': 'bg-blue-50 text-blue-700',
    'serious': 'bg-gray-100 text-gray-800',
    'determined': 'bg-indigo-100 text-indigo-800'
  };
  
  const normalizedEmotion = emotion.toLowerCase();
  return emotionBgColors[normalizedEmotion] || 'bg-gray-100 text-gray-800';
};

export const getHeatColor = (score?: number | null): string => {
  if (typeof score !== 'number') return 'text-gray-500 dark:text-gray-400';
  
  if (score >= 0.8) return 'text-red-700 dark:text-red-400';
  if (score >= 0.6) return 'text-red-600 dark:text-red-400';
  if (score >= 0.4) return 'text-orange-600 dark:text-orange-400';
  if (score >= 0.2) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
};

export const getHeatLabel = (score?: number | null): string => {
  if (typeof score !== 'number') return 'Unknown';
  
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Medium';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
};

// Ingest API
export const ingestAPI = {
  // Get YouTube video info
  getYouTubeInfo: async (url: string): Promise<any> => {
    const response = await api.get('/api/ingest/video-info', { params: { url } });
    return response.data;
  },

  // Test OpenAI API key
  testOpenAIKey: async (apiKey: string): Promise<any> => {
    const response = await api.post('/api/ingest/test-api-key', { api_key: apiKey });
    return response.data;
  },

  // Start YouTube video ingestion
  startYouTubeIngestion: async (request: any): Promise<any> => {
    const response = await api.post('/api/ingest/youtube', request);
    return response.data;
  },

  // Get processing status
  getProcessingStatus: async (videoId: string): Promise<any> => {
    const response = await api.get(`/api/ingest/status/${videoId}`);
    return response.data;
  },

  // Get all processing statuses
  getAllProcessingStatus: async (): Promise<any> => {
    const response = await api.get('/api/ingest/status');
    return response.data;
  },

  // Clear processing status
  clearProcessingStatus: async (videoId: string): Promise<any> => {
    const response = await api.delete(`/api/ingest/status/${videoId}`);
    return response.data;
  },
};

// AI Summarization API
export const summaryAPI = {
  // Get cached summary for a video
  getCachedSummary: async (videoId: number): Promise<SummaryResponse | null> => {
    try {
      const response = await api.get(`/api/summarization/video/${videoId}/cached-summary`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // No cached summary exists
      }
      throw error;
    }
  },

  // Delete cached summary to force regeneration
  deleteCachedSummary: async (videoId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/summarization/video/${videoId}/cached-summary`);
    return response.data;
  },

  // Generate video summary (will check cache first)
  generateSummary: async (
    videoId: number,
    bulletPoints: number = 4,
    customPrompt?: string,
    provider?: AIProvider,
    model?: string,
    apiKey?: string
  ): Promise<SummaryResponse> => {
    const payload: any = {
      bullet_points: bulletPoints,
    };
    
    if (customPrompt) payload.custom_prompt = customPrompt;
    if (provider) payload.provider = provider;
    if (model) payload.model = model;
    if (apiKey) payload.api_key = apiKey;

    console.log('API Request:', {
      url: `/api/summarization/video/${videoId}/summary`,
      payload
    });

    const response = await api.post(`/api/summarization/video/${videoId}/summary`, payload);
    console.log('API Response:', response.data);
    return response.data;
  },

  // Search summaries
  searchSummaries: async (
    query: string,
    page: number = 1,
    pageSize: number = 25
  ): Promise<{
    results: Array<{
      id: number;
      video_id: number;
      video_title: string;
      video_date: string | null;
      summary_text: string;
      bullet_points: number;
      provider: string;
      model: string;
      generated_at: string;
      metadata: any;
    }>;
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    query: string;
  }> => {
    const params: any = { page, page_size: pageSize };
    if (query.trim()) {
      params.q = query;
    }
    
    const response = await api.get('/api/summarization/search', { params });
    return response.data;
  },

  // Batch summarize videos
  batchSummarize: async (
    videoIds: number[],
    bulletPoints: number = 4
  ): Promise<{
    successful: SummaryResponse[];
    failed: Array<{ video_id: number; error: string }>;
    total_requested: number;
    successful_count: number;
    failed_count: number;
  }> => {
    const response = await api.post('/api/summarization/batch-summarize', {
      video_ids: videoIds,
      bullet_points: bulletPoints
    });
    return response.data;
  },

  // Get summarization stats
  getStats: async (): Promise<SummaryStats> => {
    const response = await api.get('/api/summarization/stats');
    return response.data;
  },

  // Check if video can be summarized
  canSummarize: async (videoId: number): Promise<{
    video_id: number;
    video_title: string;
    can_summarize: boolean;
    segment_count: number;
    summarization_available: boolean;
  }> => {
    const response = await api.get(`/api/summarization/video/${videoId}/can-summarize`);
    return response.data;
  },

  // Get model info
  getModelInfo: async (): Promise<{
    openai_available: boolean;
    primary_model: string | null;
    fallback_method: string;
    max_tokens_per_summary: number;
    supported_bullet_points: { min: number; max: number };
    batch_limit: number;
  }> => {
    const response = await api.get('/api/summarization/models/info');
    return response.data;
  },

  // Chat with video transcript
  chatWithVideo: async (
    videoId: number,
    message: string,
    provider?: AIProvider,
    model?: string,
    apiKey?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    includeTranscript: boolean = true
  ): Promise<{
    message: string;
    conversation_id?: string;
    metadata: {
      video_id: number;
      video_title: string;
      provider_used: string;
      model_used: string;
      has_transcript_context: boolean;
      transcript_length: number;
      conversation_length: number;
      generated_at: string;
    };
  }> => {
    const payload: any = {
      message,
      include_transcript: includeTranscript,
    };
    
    if (provider) payload.provider = provider;
    if (model) payload.model = model;
    if (apiKey) payload.api_key = apiKey;
    if (conversationHistory) payload.conversation_history = conversationHistory;

    const response = await api.post(`/api/summarization/video/${videoId}/chat`, payload);
    return response.data;
  },
};

// Convenience exports for commonly used functions
export const getImportStatus = uploadAPI.getImportStatus;
export const getAnalyticsStats = analyticsAPI.getStats;
export const getEmbeddingStatus = searchAPI.getEmbeddingStatus;

export default api;
