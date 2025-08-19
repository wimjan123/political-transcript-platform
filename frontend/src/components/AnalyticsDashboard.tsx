import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, MessageSquare, Clock, Globe, Search, RefreshCw } from 'lucide-react';
import { airtableService } from '../services/airtable';
import type { ConversationalQueryLog, SearchAnalytics } from '../services/airtable';

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SearchAnalytics[]>([]);
  const [recentQueries, setRecentQueries] = useState<ConversationalQueryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [analyticsData, queriesData] = await Promise.all([
        airtableService.getSearchAnalytics(),
        airtableService.getRecentQueries(20),
      ]);
      
      setAnalytics(analyticsData);
      setRecentQueries(queriesData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentAnalytics = analytics[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!airtableService.isConfigured()) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-2">
          <MessageSquare className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-medium text-yellow-800">Demo Mode</h3>
        </div>
        <p className="text-yellow-700 mb-4">
          This is a demonstration of the analytics dashboard. In production, this would display real data from Airtable.
        </p>
        <div className="text-sm text-yellow-600">
          <p>To enable real Airtable integration, configure:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>REACT_APP_AIRTABLE_API_KEY</li>
            <li>REACT_APP_AIRTABLE_BASE_ID</li>
            <li>REACT_APP_AIRTABLE_BASE_URL</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Search Analytics</h2>
          <p className="text-gray-500 dark:text-gray-400">Conversational search usage and insights</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {currentAnalytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Queries</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentAnalytics.totalQueries}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(currentAnalytics.avgResponseTime)}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center">
              <Search className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Search Modes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Object.keys(currentAnalytics.searchModeDistribution).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center">
              <Globe className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Languages</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Object.keys(currentAnalytics.languageDistribution).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top Queries */}
        {currentAnalytics && currentAnalytics.topQueries.length > 0 && (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 mb-4 dark:text-gray-100">Top Queries</h3>
            <div className="space-y-3">
              {currentAnalytics.topQueries.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 truncate flex-1 dark:text-gray-300">{item.query}</span>
                  <span className="text-sm font-medium text-gray-900 flex-shrink-0 dark:text-gray-100">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Mode Distribution */}
        {currentAnalytics && (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 mb-4 dark:text-gray-100">Search Mode Usage</h3>
            <div className="space-y-3">
              {Object.entries(currentAnalytics.searchModeDistribution).map(([mode, count]) => (
                <div key={mode} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      mode === 'semantic' ? 'bg-purple-500' :
                      mode === 'hybrid' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
                    <span className="text-sm text-gray-700 capitalize dark:text-gray-300">{mode}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Queries */}
      <div className="bg-white rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Conversational Queries</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Query
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {recentQueries.map((query) => (
                <tr key={query.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 max-w-xs truncate dark:text-gray-100">
                      {query.userQuery}
                    </div>
                    <div className="text-xs text-gray-500 max-w-xs truncate dark:text-gray-400">
                      Extracted: {query.extractedSearchQuery}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      query.searchMode === 'semantic' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      query.searchMode === 'hybrid' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {query.searchMode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {query.resultCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {query.responseTime}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(query.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {recentQueries.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No queries yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Start using the conversational search to see analytics here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
