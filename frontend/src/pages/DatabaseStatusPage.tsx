import React, { useState, useEffect, useCallback } from 'react';
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
  Zap,
  Upload,
  Download,
  Square,
  FileText
} from 'lucide-react';
import { ImportStatus, AnalyticsStats, EmbeddingStatus } from '../types';
import { getImportStatus, getAnalyticsStats, getEmbeddingStatus, uploadAPI, searchAPI } from '../services/api';

const DatabaseStatusPage: React.FC = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [databaseStats, setDatabaseStats] = useState<AnalyticsStats | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Only run once on mount

  useEffect(() => {
    // Safety timeout to prevent infinite loading - increased for large imports
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Force stopping loading after 30 seconds');
        setLoading(false);
        setError('Loading timed out. If an import is running, it will continue in the background. Try refreshing in a few minutes.');
      }
    }, 30000);  // Increased from 10s to 30s

    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  useEffect(() => {
    // Auto-refresh with adaptive intervals based on import status
    const getRefreshInterval = () => {
      if (importStatus?.status === 'running') {
        // More frequent updates during active imports
        return 10000; // 10 seconds
      } else if (embeddingStatus && embeddingStatus.completion_percentage < 100) {
        return 15000; // 15 seconds for embeddings
      }
      return 60000; // 60 seconds for idle state
    };

    const interval = setInterval(() => {
      if (!loading && (importStatus?.status === 'running' || 
          (embeddingStatus && embeddingStatus.completion_percentage < 100))) {
        fetchData();
      }
    }, getRefreshInterval());

    return () => clearInterval(interval);
  }, [importStatus?.status, embeddingStatus?.completion_percentage, embeddingStatus, loading, fetchData]);

  const handleStartImport = async (importType: 'html' | 'vlos' | 'both', forceReimport: boolean = false) => {
    try {
      setActionLoading('import');
      setActionMessage(null);
      
      let results = [];
      
      if (importType === 'html' || importType === 'both') {
        const htmlResult = await uploadAPI.startHtmlImport(undefined, forceReimport);
        results.push(`HTML: ${htmlResult.message}`);
      }
      
      if (importType === 'vlos' || importType === 'both') {
        const vlosResult = await uploadAPI.startVlosXmlImport(undefined, forceReimport);
        results.push(`Tweede Kamer: ${vlosResult.message}`);
      }
      
      setActionMessage(`Import started - ${results.join(', ')}`);
      
      // Refresh data after starting import
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      console.error('Failed to start import:', err);
      setActionMessage(`Failed to start import: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelImport = async () => {
    try {
      setActionLoading('cancel');
      setActionMessage(null);
      
      const result = await uploadAPI.cancelImport();
      setActionMessage(`Import cancelled: ${result.message}`);
      
      // Refresh data after cancelling
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      console.error('Failed to cancel import:', err);
      setActionMessage(`Failed to cancel import: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEmbeddings = async (forceRegenerate: boolean = false) => {
    try {
      setActionLoading('embeddings');
      setActionMessage(null);
      
      const result = await searchAPI.generateEmbeddings(forceRegenerate, 100);
      setActionMessage(`Embedding generation started: ${result.message || 'Started successfully'}`);
      
      // Refresh data after starting embeddings
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      console.error('Failed to start embedding generation:', err);
      setActionMessage(`Failed to start embedding generation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearTweedeKamer = async () => {
    try {
      if (!window.confirm('Delete all Tweede Kamer (VLOS XML) imports? This cannot be undone.')) return;
      setActionLoading('clear-tk');
      setActionMessage(null);
      const result = await uploadAPI.clearDataset('tweede_kamer', true);
      setActionMessage(result.message || 'Tweede Kamer dataset cleared');
      setTimeout(() => fetchData(), 1000);
    } catch (err) {
      console.error('Failed to clear Tweede Kamer dataset:', err);
      setActionMessage(`Failed to clear Tweede Kamer dataset: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
      case 'completed': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
      case 'failed': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
      case 'idle': return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
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

  if (loading && !importStatus && !databaseStats && !embeddingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-blue-100 p-4 rounded-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 text-center mb-2 dark:text-gray-100">Loading Database Status</h2>
              <p className="text-gray-600 text-center dark:text-gray-300">Please wait while we fetch the latest information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center dark:text-gray-100">
                <div className="bg-blue-100 p-2 sm:p-3 rounded-xl mr-3 sm:mr-4">
                  <Database className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
                <div>
                  <span>Database Status</span>
                  {lastUpdated && (
                    <div className="text-xs sm:text-sm text-gray-500 font-normal mt-1 sm:hidden dark:text-gray-400">
                      Updated: {lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base dark:text-gray-300">
                Monitor import progress and database statistics
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4">
              {lastUpdated && (
                <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200 shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm dark:bg-red-900/30 dark:border-red-800">
            <div className="flex">
              <div className="bg-red-100 p-2 rounded-lg mr-3 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-1 dark:text-red-300">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {actionMessage && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex">
              <div className="bg-blue-100 p-2 rounded-lg mr-3 flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-800 mb-1 dark:text-blue-300">Success</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">{actionMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Database Controls */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl mb-8 border border-gray-100 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl border-b border-gray-100 dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center dark:text-gray-100">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              Database Controls
            </h2>
            <p className="text-sm text-gray-600 mt-1 dark:text-gray-300">Manage HTML imports and embedding generation</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Unified Import Controls */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 sm:p-5 rounded-xl border border-green-100 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-900/30">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg mr-3">
                    <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Data Import</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Process transcript files</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handleStartImport('both', false)}
                    disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    {actionLoading === 'import' ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start All Imports
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartImport('html', false)}
                      disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                      HTML Only
                    </button>
                    <button
                      onClick={() => handleStartImport('vlos', false)}
                      disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                      Tweede Kamer Only
                    </button>
                  </div>
                  <button
                    onClick={() => handleStartImport('both', true)}
                    disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Force Reimport All
                  </button>
                  {importStatus?.status === 'running' && (
                    <button
                      onClick={handleCancelImport}
                      disabled={actionLoading === 'cancel'}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                      {actionLoading === 'cancel' ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4 mr-2" />
                      )}
                      Cancel Import
                    </button>
                  )}
                </div>
              </div>

              {/* Tweede Kamer Management */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 sm:p-5 rounded-xl border border-indigo-100 dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-900/30">
                <div className="flex items-center mb-4">
                  <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg mr-3">
                    <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tweede Kamer Management</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Manage Dutch Parliament data</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={handleClearTweedeKamer}
                    disabled={actionLoading === 'clear-tk'}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    {actionLoading === 'clear-tk' ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Delete Tweede Kamer Data
                  </button>
                </div>
              </div>

              {/* Embedding Controls */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 sm:p-5 rounded-xl border border-purple-100 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-900/30">
                <div className="flex items-center mb-4">
                  <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg mr-3">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Embeddings</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Semantic search vectors</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handleStartEmbeddings(false)}
                    disabled={actionLoading === 'embeddings' || (embeddingStatus?.completion_percentage ?? 0) >= 100}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    {actionLoading === 'embeddings' ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Generate Embeddings
                  </button>
                  <button
                    onClick={() => handleStartEmbeddings(true)}
                    disabled={actionLoading === 'embeddings'}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate All
                  </button>
                </div>
              </div>

              {/* Status Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 sm:p-5 rounded-xl border border-blue-100 dark:border-blue-900/30 md:col-span-2 lg:col-span-1 lg:row-start-1 lg:col-start-3">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg mr-3">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Quick Stats</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Database overview</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {databaseStats && (
                    <>
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-lg border border-blue-100 dark:border-blue-800">
                        <span className="text-gray-600 dark:text-gray-300">Videos</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_videos.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-lg border border-blue-100 dark:border-blue-800">
                        <span className="text-gray-600 dark:text-gray-300">Segments</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_segments.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-lg border border-blue-100 dark:border-blue-800">
                        <span className="text-gray-600 dark:text-gray-300">Speakers</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_speakers.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {embeddingStatus && (
                    <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded-lg border border-purple-100 dark:border-purple-800">
                      <span className="text-gray-600 dark:text-gray-300">Embeddings</span>
                      <span className="font-semibold text-purple-600">{embeddingStatus.completion_percentage.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:gap-8">
          {/* Import Status */}
          {importStatus && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  {getStatusIcon(importStatus.status)}
                  <span className="ml-2">Import Status</span>
                  {importStatus.job_type && (
                    <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {importStatus.job_type}
                    </span>
                  )}
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
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                        <span>Progress</span>
                        <span>{importStatus.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                        <div
                          className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(importStatus.progress, 2)}%` }}
                        >
                          {importStatus.progress > 10 && (
                            <div className="w-2 h-2 bg-blue-200 dark:bg-blue-300 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </div>
                      {importStatus.total_files > 1000 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mb-2">>
                          ⚠️ Large import in progress ({importStatus.total_files.toLocaleString()} files). 
                          This may take several hours to complete. The process will continue even if you close this page.
                        </div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Processing: {importStatus.processed_files.toLocaleString()} of {importStatus.total_files.toLocaleString()} files
                        {importStatus.job_type && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {importStatus.job_type === 'vlos_xml_import' ? 'Tweede Kamer' : 'HTML'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {importStatus.total_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Files</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {importStatus.processed_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Processed</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {importStatus.failed_files.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
                    </div>
                  </div>

                  {/* Current File */}
                  {importStatus.current_file && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Currently Processing:
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg break-all">
                        {importStatus.current_file.split('/').pop()}
                      </p>
                    </div>
                  )}

                  {/* Errors */}
                  {importStatus.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Recent Errors:
                      </h3>
                      <div className="max-h-32 overflow-y-auto">
                        {importStatus.errors.slice(-5).map((error, index) => (
                          <p key={index} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded mb-1">
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
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                  Semantic Search Embeddings
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Progress Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Embedding Generation Progress
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        embeddingStatus.completion_percentage >= 100 
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                          : embeddingStatus.completion_percentage > 0
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                          : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50'
                      }`}>
                        {embeddingStatus.completion_percentage >= 100 ? 'Complete' : 
                         embeddingStatus.completion_percentage > 0 ? 'Generating...' : 'Not Started'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                      <span>Progress</span>
                      <span>{embeddingStatus.completion_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          embeddingStatus.completion_percentage >= 100 
                            ? 'bg-green-500 dark:bg-green-400' 
                            : 'bg-purple-600 dark:bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(embeddingStatus.completion_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {embeddingStatus.total_segments.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total Segments</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {embeddingStatus.segments_with_embeddings.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">With Embeddings</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                      <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                        {embeddingStatus.segments_without_embeddings.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Remaining</div>
                    </div>
                  </div>

                  {/* Model Information */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <Zap className="h-4 w-4 mr-1" />
                      Model Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Model:</span>
                        <span className="ml-2 font-mono text-purple-600 dark:text-purple-400">
                          {embeddingStatus.embedding_model}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
                        <span className="ml-2 font-mono text-purple-600 dark:text-purple-400">
                          {embeddingStatus.embedding_dimensions}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  {embeddingStatus.latest_generation_time && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {new Date(embeddingStatus.latest_generation_time).toLocaleString()}
                    </div>
                  )}

                  {/* Status Message */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-3">
                    <div className="flex">
                      <div className="ml-3">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
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

        {/* Database Statistics and Top Statistics - Unified Layout */}
        {databaseStats && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Database Statistics */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg xl:col-span-2">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Database Statistics
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Videos */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center min-h-[100px]">
                    <div className="flex-shrink-0">
                      <Video className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-100 truncate">
                        {databaseStats.total_videos.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">Videos</div>
                    </div>
                  </div>

                  {/* Segments */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 flex items-center min-h-[100px]">
                    <div className="flex-shrink-0">
                      <BarChart3 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="text-xl lg:text-2xl font-bold text-green-900 dark:text-green-100 truncate">
                        {databaseStats.total_segments.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">Segments</div>
                    </div>
                  </div>

                  {/* Speakers */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 flex items-center min-h-[100px]">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="text-xl lg:text-2xl font-bold text-purple-900 dark:text-purple-100 truncate">
                        {databaseStats.total_speakers.toLocaleString()}
                      </div>
                      <div className="text-sm text-purple-700 dark:text-purple-300">Speakers</div>
                    </div>
                  </div>

                  {/* Topics */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 flex items-center min-h-[100px]">
                    <div className="flex-shrink-0">
                      <Tag className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="text-xl lg:text-2xl font-bold text-orange-900 dark:text-orange-100 truncate">
                        {databaseStats.total_topics.toLocaleString()}
                      </div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">Topics</div>
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                {databaseStats.date_range && (databaseStats.date_range.min_date || databaseStats.date_range.max_date) && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Coverage</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
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

            {/* Top Speakers - Now in same grid */}
            {databaseStats.top_speakers && databaseStats.top_speakers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg lg:col-span-1">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Top Speakers</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {databaseStats.top_speakers.slice(0, 5).map((speaker, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{speaker.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {speaker.segment_count.toLocaleString()} segments
                          </div>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <div className={`text-sm px-2 py-1 rounded ${
                            speaker.avg_sentiment > 0 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                              : speaker.avg_sentiment < 0 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
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

            {/* Top Topics - Now in same grid */}
            {databaseStats.top_topics && databaseStats.top_topics.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg lg:col-span-1 xl:col-span-1">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Top Topics</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {databaseStats.top_topics.slice(0, 5).map((topic, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{topic.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {topic.frequency.toLocaleString()} occurrences
                          </div>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
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
