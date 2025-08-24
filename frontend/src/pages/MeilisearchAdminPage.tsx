import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  Play, 
  Pause, 
  Trash2, 
  Settings, 
  Info,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  Server,
  Activity
} from 'lucide-react';

interface MeilisearchIndex {
  uid: string;
  primaryKey: string | null;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
}

interface MeilisearchTask {
  uid: number;
  indexUid: string;
  status: 'enqueued' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  type: string;
  details: any;
  error?: any;
  duration?: string;
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

interface MeilisearchStats {
  databaseSize: number;
  lastUpdate: string;
  indexes: Record<string, {
    numberOfDocuments: number;
    isIndexing: boolean;
    fieldDistribution: Record<string, number>;
  }>;
}

interface SyncProgress {
  postgresql_total: number;
  meilisearch_count: number;
  progress_percent: number;
  remaining: number;
  is_complete: boolean;
  is_indexing: boolean;
}

interface ExperimentalFeatures {
  vectorStore: boolean;
  metrics: boolean;
  logsRoute: boolean;
}

const MeilisearchAdminPage: React.FC = () => {
  const [indexes, setIndexes] = useState<MeilisearchIndex[]>([]);
  const [tasks, setTasks] = useState<MeilisearchTask[]>([]);
  const [stats, setStats] = useState<MeilisearchStats | null>(null);
  const [experimentalFeatures, setExperimentalFeatures] = useState<ExperimentalFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch indexes
      const indexesResponse = await fetch('/api/meilisearch/indexes');
      const indexesData = await indexesResponse.json();
      setIndexes(indexesData.results || []);

      // Fetch recent tasks
      const tasksResponse = await fetch('/api/meilisearch/tasks?limit=20');
      const tasksData = await tasksResponse.json();
      setTasks(tasksData.results || []);

      // Fetch stats
      const statsResponse = await fetch('/api/meilisearch/stats');
      const statsData = await statsResponse.json();
      setStats(statsData);

      // Fetch experimental features
      const featuresResponse = await fetch('/api/meilisearch/experimental-features');
      const featuresData = await featuresResponse.json();
      setExperimentalFeatures(featuresData);

      // Fetch sync progress
      try {
        const progressResponse = await fetch('/api/meilisearch/sync/progress');
        const progressData = await progressResponse.json();
        setSyncProgress(progressData);
      } catch (progressErr) {
        // Progress API might not be available, ignore this error
        console.warn('Could not fetch sync progress:', progressErr);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Meilisearch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const triggerSync = async () => {
    try {
      setError(null);
      setIsSyncing(true);
      const response = await fetch('/api/meilisearch/sync', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }
      fetchData(); // Refresh data after triggering sync
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerFullSync = async () => {
    if (!window.confirm('This will sync ALL 2.6M segments to Meilisearch. This may take 20-30 minutes. Continue?')) {
      return;
    }
    
    try {
      setError(null);
      setIsSyncing(true);
      const response = await fetch('/api/meilisearch/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_sync: true,
          batch_size: 25000
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger full sync');
      }
      
      // Start monitoring progress
      const monitorInterval = setInterval(fetchData, 5000);
      setTimeout(() => clearInterval(monitorInterval), 1800000); // Stop after 30 minutes
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger full sync');
      setIsSyncing(false);
    }
  };

  const deleteIndex = async (indexUid: string) => {
    if (!window.confirm(`Are you sure you want to delete the index "${indexUid}"?`)) {
      return;
    }
    
    try {
      setError(null);
      const response = await fetch(`/api/meilisearch/indexes/${indexUid}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete index');
      }
      fetchData(); // Refresh data after deletion
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete index');
    }
  };

  const createIndex = async () => {
    const indexName = prompt('Enter index name:');
    if (!indexName) return;
    
    try {
      setError(null);
      const response = await fetch('/api/meilisearch/indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: indexName, primaryKey: 'id' })
      });
      if (!response.ok) {
        throw new Error('Failed to create index');
      }
      fetchData(); // Refresh data after creation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create index');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'enqueued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'text-green-700 bg-green-100';
      case 'failed':
        return 'text-red-700 bg-red-100';
      case 'processing':
        return 'text-blue-700 bg-blue-100';
      case 'enqueued':
        return 'text-yellow-700 bg-yellow-100';
      case 'canceled':
        return 'text-gray-700 bg-gray-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading Meilisearch data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4 sm:p-6 mb-8 dark:bg-gray-800/70 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meilisearch Admin</h1>
                <p className="text-gray-600 dark:text-gray-300">Manage search indexes and monitor status</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <button
                onClick={toggleAutoRefresh}
                className={`inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md transition-colors ${
                  autoRefresh 
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <Activity className="h-4 w-4 mr-2" />
                Auto Refresh
              </button>
              <button
                onClick={fetchData}
                className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {isSyncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {isSyncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                onClick={triggerFullSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                <Database className="h-4 w-4 mr-2" />
                Full Sync (2.6M)
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/30 dark:border-red-800">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-400 mr-3" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Sync Progress Panel */}
        {syncProgress && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4 sm:p-6 mb-8 dark:bg-gray-800/70 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Sync Progress</h2>
              <div className="flex items-center space-x-2">
                {syncProgress.is_indexing && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  syncProgress.is_complete ? 'bg-green-100 text-green-800' : 
                  syncProgress.is_indexing ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {syncProgress.is_complete ? 'Complete' : 
                   syncProgress.is_indexing ? 'Indexing' : 'Partial'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Documents Indexed</span>
                  <span>{syncProgress.progress_percent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(syncProgress.progress_percent, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {syncProgress.meilisearch_count.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Indexed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {syncProgress.postgresql_total.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {syncProgress.remaining.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {syncProgress.progress_percent.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Complete</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 sm:p-6 dark:bg-gray-800/70 dark:border-gray-700">
              <div className="flex items-center">
                <Server className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Database Size</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatBytes(stats.databaseSize || 0)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 sm:p-6 dark:bg-gray-800/70 dark:border-gray-700">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Indexes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{indexes.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 sm:p-6 dark:bg-gray-800/70 dark:border-gray-700">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Documents</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {Object.values(stats.indexes || {}).reduce((sum, index) => sum + index.numberOfDocuments, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 sm:p-6 dark:bg-gray-800/70 dark:border-gray-700">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vector Store</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {experimentalFeatures?.vectorStore ? (
                      <span className="text-green-600">Enabled</span>
                    ) : (
                      <span className="text-red-600">Disabled</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Indexes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4 sm:p-6 mb-8 dark:bg-gray-800/70 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Search Indexes</h2>
            <button
              onClick={createIndex}
              className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <Database className="h-4 w-4 mr-2" />
              Create Index
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Index</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Primary Key</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Documents</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {indexes.map((index) => {
                  const indexStats = stats?.indexes?.[index.uid];
                  return (
                    <tr key={index.uid}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{index.uid}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">{index.primaryKey || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {indexStats?.numberOfDocuments?.toLocaleString() || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {indexStats?.isIndexing ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Indexing
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(index.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setSelectedIndex(index.uid)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteIndex(index.uid)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4 sm:p-6 dark:bg-gray-800/70 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Recent Tasks</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Index</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Enqueued</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task.uid}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{task.uid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {task.indexUid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {task.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(task.status)}
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {task.duration || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(task.enqueuedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeilisearchAdminPage;
