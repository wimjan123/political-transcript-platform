import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause,
  AlertTriangle,
  BarChart3,
  Video,
  Users,
  Tag,
  Brain,
  Zap
} from 'lucide-react';
import { ImportStatus, AnalyticsStats, EmbeddingStatus } from '../types';
import { getImportStatus, getAnalyticsStats, getEmbeddingStatus } from '../services/api';

const DatabaseStatusPage: React.FC = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [databaseStats, setDatabaseStats] = useState<AnalyticsStats | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting to fetch database status data...');
      
      // Fetch data individually to better handle errors
      try {
        console.log('Fetching import status...');
        const statusResponse = await getImportStatus();
        console.log('Import status received:', statusResponse);
        setImportStatus(statusResponse);
      } catch (err) {
        console.error('Failed to fetch import status:', err);
        setImportStatus(null);
      }

      try {
        console.log('Fetching analytics stats...');
        const statsResponse = await getAnalyticsStats();
        console.log('Analytics stats received:', statsResponse);
        setDatabaseStats(statsResponse);
      } catch (err) {
        console.error('Failed to fetch analytics stats:', err);
        setDatabaseStats(null);
      }

      try {
        console.log('Fetching embedding status...');
        const embeddingResponse = await getEmbeddingStatus();
        console.log('Embedding status received:', embeddingResponse);
        setEmbeddingStatus(embeddingResponse);
      } catch (err) {
        console.error('Failed to fetch embedding status:', err);
        setEmbeddingStatus(null);
      }

      setLastUpdated(new Date());
      console.log('All data fetching completed');
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch database status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Force stopping loading after 10 seconds');
        setLoading(false);
        setError('Loading timed out. Please try refreshing the page.');
      }
    }, 10000);

    // Auto-refresh every 30 seconds if import is running or embeddings are being generated
    const interval = setInterval(() => {
      if (importStatus?.status === 'running' || 
          (embeddingStatus && embeddingStatus.completion_percentage < 100)) {
        fetchData();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
    };
  }, [importStatus?.status, embeddingStatus?.completion_percentage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'idle': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-5 w-5" />;
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'failed': return <XCircle className="h-5 w-5" />;
      case 'idle': return <Pause className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
            <span className="ml-3 text-lg">Loading database status...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Database className="h-8 w-8 mr-3 text-primary-600" />
              Database Status
            </h1>
            <p className="text-gray-600 mt-2">
              Monitor import progress and database statistics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* Import Status */}
          {importStatus && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {getStatusIcon(importStatus.status)}
                  <span className="ml-2">Import Status</span>
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(importStatus.status)}`}>
                      {importStatus.status.charAt(0).toUpperCase() + importStatus.status.slice(1)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {importStatus.status === 'running' && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{importStatus.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* File Statistics */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {importStatus.total_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Total Files</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">
                        {importStatus.processed_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Processed</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-600">
                        {importStatus.failed_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Failed</div>
                    </div>
                  </div>

                  {/* Current File */}
                  {importStatus.current_file && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Currently Processing:
                      </h3>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg break-all">
                        {importStatus.current_file.split('/').pop()}
                      </p>
                    </div>
                  )}

                  {/* Errors */}
                  {importStatus.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Recent Errors:
                      </h3>
                      <div className="max-h-32 overflow-y-auto">
                        {importStatus.errors.slice(-5).map((error, index) => (
                          <p key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded mb-1">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Semantic Search Embeddings Status */}
          {embeddingStatus && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-purple-600" />
                  Semantic Search Embeddings
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Progress Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Embedding Generation Progress
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        embeddingStatus.completion_percentage >= 100 
                          ? 'text-green-600 bg-green-50'
                          : embeddingStatus.completion_percentage > 0
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 bg-gray-50'
                      }`}>
                        {embeddingStatus.completion_percentage >= 100 ? 'Complete' : 
                         embeddingStatus.completion_percentage > 0 ? 'Generating...' : 'Not Started'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{embeddingStatus.completion_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          embeddingStatus.completion_percentage >= 100 
                            ? 'bg-green-500' 
                            : 'bg-purple-600'
                        }`}
                        style={{ width: `${Math.min(embeddingStatus.completion_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-gray-900">
                        {embeddingStatus.total_segments.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Total Segments</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-purple-600">
                        {embeddingStatus.segments_with_embeddings.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">With Embeddings</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-orange-600">
                        {embeddingStatus.segments_without_embeddings.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Remaining</div>
                    </div>
                  </div>

                  {/* Model Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Zap className="h-4 w-4 mr-1" />
                      Model Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Model:</span>
                        <span className="ml-2 font-mono text-purple-600">
                          {embeddingStatus.embedding_model}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Dimensions:</span>
                        <span className="ml-2 font-mono text-purple-600">
                          {embeddingStatus.embedding_dimensions}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  {embeddingStatus.latest_generation_time && (
                    <div className="text-xs text-gray-500">
                      Last updated: {new Date(embeddingStatus.latest_generation_time).toLocaleString()}
                    </div>
                  )}

                  {/* Status Message */}
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3">
                    <div className="flex">
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          {embeddingStatus.completion_percentage >= 100 
                            ? '✅ Semantic search is fully operational with all segments embedded.'
                            : embeddingStatus.completion_percentage > 0 
                            ? '🔄 Embeddings are being generated in the background. Semantic search is partially available.'
                            : '⏳ Embedding generation has not started yet. Use regular search for now.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database Statistics and other sections */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Database Statistics */}
          {databaseStats && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Database Statistics
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Videos */}
                  <div className="bg-blue-50 rounded-lg p-4 flex items-center">
                    <div className="flex-shrink-0">
                      <Video className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-2xl font-bold text-blue-900">
                        {databaseStats.total_videos.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700">Videos</div>
                    </div>
                  </div>

                  {/* Segments */}
                  <div className="bg-green-50 rounded-lg p-4 flex items-center">
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-2xl font-bold text-green-900">
                        {databaseStats.total_segments.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700">Segments</div>
                    </div>
                  </div>

                  {/* Speakers */}
                  <div className="bg-purple-50 rounded-lg p-4 flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-2xl font-bold text-purple-900">
                        {databaseStats.total_speakers.toLocaleString()}
                      </div>
                      <div className="text-sm text-purple-700">Speakers</div>
                    </div>
                  </div>

                  {/* Topics */}
                  <div className="bg-orange-50 rounded-lg p-4 flex items-center">
                    <div className="flex-shrink-0">
                      <Tag className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-2xl font-bold text-orange-900">
                        {databaseStats.total_topics.toLocaleString()}
                      </div>
                      <div className="text-sm text-orange-700">Topics</div>
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                {databaseStats.date_range && (databaseStats.date_range.min_date || databaseStats.date_range.max_date) && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Data Coverage</h3>
                    <div className="text-sm text-gray-600">
                      {databaseStats.date_range.min_date && (
                        <div>
                          <strong>From:</strong> {new Date(databaseStats.date_range.min_date).toLocaleDateString()}
                        </div>
                      )}
                      {databaseStats.date_range.max_date && (
                        <div>
                          <strong>To:</strong> {new Date(databaseStats.date_range.max_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top Statistics */}
        {databaseStats && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Speakers */}
            {databaseStats.top_speakers && databaseStats.top_speakers.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Speakers</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {databaseStats.top_speakers.slice(0, 5).map((speaker, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{speaker.name}</div>
                          <div className="text-sm text-gray-600">
                            {speaker.segment_count.toLocaleString()} segments
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm px-2 py-1 rounded ${
                            speaker.avg_sentiment > 0 
                              ? 'bg-green-100 text-green-800' 
                              : speaker.avg_sentiment < 0 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {speaker.avg_sentiment > 0 ? 'Positive' : speaker.avg_sentiment < 0 ? 'Negative' : 'Neutral'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top Topics */}
            {databaseStats.top_topics && databaseStats.top_topics.length > 0 && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Topics</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {databaseStats.top_topics.slice(0, 5).map((topic, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{topic.name}</div>
                          <div className="text-sm text-gray-600">
                            {topic.frequency.toLocaleString()} occurrences
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            Score: {topic.avg_score.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseStatusPage;