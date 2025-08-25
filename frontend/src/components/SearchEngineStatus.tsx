import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, XCircle, RefreshCw, Settings, Zap, 
  Database, Search, TrendingUp, AlertTriangle,
  Clock, Server, Activity
} from 'lucide-react';
import { searchAPI } from '../services/api';

interface SearchEngineStatusProps {
  compact?: boolean;
  showActions?: boolean;
}

const SearchEngineStatus: React.FC<SearchEngineStatusProps> = ({ 
  compact = false, 
  showActions = true 
}) => {
  const [reindexEngine, setReindexEngine] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch engine status
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['search-engine-status'],
    queryFn: searchAPI.getEngineStatus,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
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
    mutationFn: ({ engine, batchSize }: { engine: string; batchSize: number }) =>
      searchAPI.reindexEngines(engine as any, batchSize),
    onSuccess: () => {
      setReindexEngine('');
      queryClient.invalidateQueries({ queryKey: ['search-engine-status'] });
    },
  });

  const getStatusIcon = (healthy: boolean) => {
    if (healthy) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusColor = (healthy: boolean) => {
    return healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm">
        Failed to load search engine status
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="flex items-center space-x-1">
          <Search className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600 dark:text-gray-300">
            {status.primary_engine}
          </span>
          {getStatusIcon(status.engines[status.primary_engine]?.healthy)}
        </div>
        {status.engines[status.fallback_engine]?.healthy && (
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <span>+</span>
            <span>{status.fallback_engine}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search Engine Status
          </h3>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Refresh status"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Primary and Fallback Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Primary Engine
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold capitalize text-blue-900 dark:text-blue-100">
              {status.primary_engine}
            </span>
            {getStatusIcon(status.engines[status.primary_engine]?.healthy)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Database className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fallback Engine
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold capitalize text-gray-700 dark:text-gray-300">
              {status.fallback_engine}
            </span>
            {getStatusIcon(status.engines[status.fallback_engine]?.healthy)}
          </div>
        </div>
      </div>

      {/* Engine Details */}
      <div className="space-y-4">
        {Object.entries(status.engines).map(([engineName, engineStatus]) => (
          <div 
            key={engineName}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Server className="h-5 w-5 text-gray-400" />
                <span className="text-lg font-medium capitalize text-gray-900 dark:text-white">
                  {engineName}
                </span>
                {getStatusIcon(engineStatus.healthy)}
              </div>
              
              {showActions && engineName !== status.primary_engine && engineStatus.healthy && (
                <button
                  onClick={() => switchEngineMutation.mutate(engineName as any)}
                  disabled={switchEngineMutation.isPending}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 transition-colors"
                >
                  Make Primary
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className={`ml-2 font-medium ${getStatusColor(engineStatus.healthy)}`}>
                  {engineStatus.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>

              {engineStatus.url && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">URL:</span>
                  <span className="ml-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {engineStatus.url}
                  </span>
                </div>
              )}

              {engineStatus.cluster_status && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cluster:</span>
                  <span className={`ml-2 font-medium capitalize ${
                    engineStatus.cluster_status === 'green' ? 'text-green-600' :
                    engineStatus.cluster_status === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {engineStatus.cluster_status}
                  </span>
                </div>
              )}

              {engineStatus.nodes && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Nodes:</span>
                  <span className="ml-2 text-gray-700 dark:text-gray-300">
                    {engineStatus.nodes}
                  </span>
                </div>
              )}

              {engineStatus.error && (
                <div className="md:col-span-3">
                  <span className="text-gray-500 dark:text-gray-400">Error:</span>
                  <span className="ml-2 text-red-600 dark:text-red-400 text-xs font-mono">
                    {engineStatus.error}
                  </span>
                </div>
              )}
            </div>

            {/* Reindex Actions */}
            {showActions && engineStatus.healthy && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Reindex data to {engineName}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Reindex all data to ${engineName}? This may take several minutes.`)) {
                        reindexMutation.mutate({ 
                          engine: engineName,
                          batchSize: 500 
                        });
                        setReindexEngine(engineName);
                      }
                    }}
                    disabled={reindexMutation.isPending && reindexEngine === engineName}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {reindexMutation.isPending && reindexEngine === engineName ? (
                      <div className="flex items-center space-x-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Reindexing...</span>
                      </div>
                    ) : (
                      'Reindex'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (confirm('Reindex all data to both engines? This may take several minutes.')) {
                  reindexMutation.mutate({ 
                    engine: 'all',
                    batchSize: 500 
                  });
                  setReindexEngine('all');
                }
              }}
              disabled={reindexMutation.isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {reindexMutation.isPending && reindexEngine === 'all' ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Reindexing All...</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  <span>Reindex All Engines</span>
                </>
              )}
            </button>

            {switchEngineMutation.isPending && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Switching engines...</span>
              </div>
            )}

            {reindexMutation.isError && (
              <div className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Reindex failed: {reindexMutation.error?.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchEngineStatus;