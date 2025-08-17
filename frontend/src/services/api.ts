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
  SummaryStats
} from '@/types';

// Determine API base URL
// - If REACT_APP_API_URL is set, use it.
// - If running via CRA dev server (port 3000), use relative URLs and rely on proxy.
// - Otherwise default to same-origin relative paths.
const inferBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl !== undefined) return envUrl; // allow empty string to mean relative
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '3000') return '';
  }
  return '';
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

// Search API
export const searchAPI = {
  // Search transcripts
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const response = await api.get('/api/search/', { params });
    return response.data;
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
    return response.data;
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
    return response.data;
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
  if (score === undefined || score === null) return 'text-gray-500';
  if (score > 0.1) return 'text-green-600';
  if (score < -0.1) return 'text-red-600';
  return 'text-gray-600';
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
  // Generate video summary
  generateSummary: async (
    videoId: number,
    bulletPoints: number = 4,
    customPrompt?: string
  ): Promise<SummaryResponse> => {
    const response = await api.post(`/api/summarization/video/${videoId}/summary`, {
      bullet_points: bulletPoints,
      custom_prompt: customPrompt,
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
};

// Convenience exports for commonly used functions
export const getImportStatus = uploadAPI.getImportStatus;
export const getAnalyticsStats = analyticsAPI.getStats;
export const getEmbeddingStatus = searchAPI.getEmbeddingStatus;

export default api;
