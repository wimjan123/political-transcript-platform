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
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Force stopping loading after 10 seconds');
        setLoading(false);
        setError('Loading timed out. Please try refreshing the page.');
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  useEffect(() => {
    // Auto-refresh every 30 seconds if import is running or embeddings are being generated
    const interval = setInterval(() => {
      if (!loading && (importStatus?.status === 'running' || 
          (embeddingStatus && embeddingStatus.completion_percentage < 100))) {
        fetchData();
      }
    }, 30000);

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
        <div className="bg-white shadow-lg rounded-xl mb-8 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
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
                  <div className="bg-green-100 p-2 rounded-lg mr-3">
                    <Upload className="h-5 w-5 text-green-600" />
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
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                      HTML Only
                    </button>
                    <button
                      onClick={() => handleStartImport('vlos', false)}
                      disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                    >
                      Tweede Kamer Only
                    </button>
                  </div>
                  <button
                    onClick={() => handleStartImport('both', true)}
                    disabled={actionLoading === 'import' || importStatus?.status === 'running'}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
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
                  <div className="bg-indigo-100 p-2 rounded-lg mr-3">
                    <FileText className="h-5 w-5 text-indigo-600" />
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
                  <div className="bg-purple-100 p-2 rounded-lg mr-3">
                    <Brain className="h-5 w-5 text-purple-600" />
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
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate All
                  </button>
                </div>
              </div>

              {/* Status Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 sm:p-5 rounded-xl border border-blue-100 md:col-span-2 lg:col-span-1">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Quick Stats</h3>
                    <p className="text-xs text-gray-600">Database overview</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {databaseStats && (
                    <>
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600">Videos</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_videos.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600">Segments</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_segments.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600">Speakers</span>
                        <span className="font-semibold text-blue-600">{databaseStats.total_speakers.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {embeddingStatus && (
                    <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-purple-100">
                      <span className="text-gray-600">Embeddings</span>
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
            <div className="bg-white shadow rounded-lg dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {getStatusIcon(importStatus.status)}
                  <span className="ml-2">Import Status</span>
                  {importStatus.job_type && (
                    <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
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
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
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
