import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, Database, RefreshCw, Zap, Activity,
  Play, Pause, RotateCcw, AlertTriangle, CheckCircle,
  XCircle, Clock, TrendingUp, BarChart3
} from 'lucide-react';
import { searchAPI } from '../services/api';

const SearchEngineAdmin: React.FC = () => {
  const [compareQuery, setCompareQuery] = useState('');
  const [reindexEngine, setReindexEngine] = useState<'all' | 'elasticsearch' | 'meilisearch'>('all');
  const [batchSize, setBatchSize] = useState(500);
  const queryClient = useQueryClient();

  // Fetch engine status
  const { data: status, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ['search-engine-status'],
    queryFn: searchAPI.getEngineStatus,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Compare engines mutation
  const compareEnginesMutation = useMutation({
    mutationFn: (query: string) => searchAPI.compareEngines(query),
    onSuccess: (data) => {
      console.log('Engine comparison results:', data);
    },
  });

  // Switch primary engine mutation
  const switchEngineMutation = useMutation({
    mutationFn: (engine: 'elasticsearch' | 'meilisearch') => 
      searchAPI.switchPrimaryEngine(engine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-engine-status'] });
    },
  });

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: ({ engine, batchSize }: { engine: 'all' | 'elasticsearch' | 'meilisearch'; batchSize: number }) =>
      searchAPI.reindexEngines(engine as any, batchSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-engine-status'] });
    },
  });

  const getStatusIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusColor = (healthy: boolean) => {
    return healthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  if (statusLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Search Engine Administration
          </h3>
        </div>
        <div className="p-6">
          {/* Engine Status Overview */}
          {status && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {Object.entries(status.engines).map(([engineName, engineStatus]) => (
                <div
                  key={engineName}
                  className={`rounded-lg border p-4 ${getStatusColor(engineStatus.healthy)}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 capitalize flex items-center">
                      {getStatusIcon(engineStatus.healthy)}
                      <span className="ml-2">{engineName}</span>
                      {status.primary_engine === engineName && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          Primary
                        </span>
                      )}
                      {status.fallback_engine === engineName && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                          Fallback
                        </span>
                      )}
                    </h4>
                    <button
                      onClick={() => 
                        switchEngineMutation.mutate(engineName as 'elasticsearch' | 'meilisearch')
                      }
                      disabled={status.primary_engine === engineName || switchEngineMutation.isPending}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Set Primary
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">URL:</span>
                      <span className="font-mono text-xs">{engineStatus.url || 'N/A'}</span>
                    </div>
                    
                    {engineStatus.cluster_status && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cluster:</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            engineStatus.cluster_status === 'green' ? 'bg-green-100 text-green-800' :
                            engineStatus.cluster_status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {engineStatus.cluster_status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nodes:</span>
                          <span>{engineStatus.nodes}</span>
                        </div>
                      </>
                    )}
                    
                    {engineStatus.error && (
                      <div className="text-red-600 text-xs mt-2">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        {engineStatus.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Management Actions */}
          <div className="space-y-6">
            {/* Engine Comparison */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Engine Comparison
              </h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={compareQuery}
                  onChange={(e) => setCompareQuery(e.target.value)}
                  placeholder="Enter search query to compare engines..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => compareQuery.trim() && compareEnginesMutation.mutate(compareQuery)}
                  disabled={!compareQuery.trim() || compareEnginesMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {compareEnginesMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Compare
                    </>
                  )}
                </button>
              </div>
              
              {compareEnginesMutation.data && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(compareEnginesMutation.data).map(([engine, result]: [string, any]) => (
                    <div key={engine} className="bg-white rounded border p-3">
                      <h5 className="font-medium capitalize mb-2">{engine}</h5>
                      {result.error ? (
                        <p className="text-red-600 text-sm">{result.error}</p>
                      ) : (
                        <div className="text-sm space-y-1">
                          <div>Results: <span className="font-medium">{result.total}</span></div>
                          <div>Time: <span className="font-medium">{result.took}ms</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reindexing */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Reindex Data
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Engine
                  </label>
                  <select
                    value={reindexEngine}
                    onChange={(e) => setReindexEngine(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Engines</option>
                    <option value="elasticsearch">Elasticsearch Only</option>
                    <option value="meilisearch">Meilisearch Only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 500)}
                    min="100"
                    max="2000"
                    step="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={() => reindexMutation.mutate({ engine: reindexEngine, batchSize })}
                    disabled={reindexMutation.isPending}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    {reindexMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Reindexing...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Start Reindex
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {reindexMutation.data && (
                <div className="mt-4 p-3 bg-white rounded border">
                  <h5 className="font-medium mb-2">Reindex Results:</h5>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(reindexMutation.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Refresh Status */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <button
                onClick={() => refetch()}
                className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchEngineAdmin;