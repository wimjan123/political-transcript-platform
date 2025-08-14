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
  Video,
  VideoStats,
  TranscriptSegment,
  ImportStatus
} from '@/types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
};

// Analytics API
export const analyticsAPI = {
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
    speaker?: string
  ): Promise<TranscriptSegment[]> => {
    const response = await api.get(`/api/videos/${videoId}/segments`, {
      params: { page, page_size: pageSize, speaker },
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

export const getSentimentColor = (score?: number): string => {
  if (score === undefined || score === null) return 'text-gray-500';
  if (score > 0.1) return 'text-green-600';
  if (score < -0.1) return 'text-red-600';
  return 'text-gray-600';
};

export const getSentimentLabel = (score?: number): string => {
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

export default api;