import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  BarChart3, Search, Clock, Hash, TrendingUp, 
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,
  Zap, Database
} from 'lucide-react';
import { searchAPI } from '../services/api';

interface ComparisonResult {
  [engine: string]: {
    total: number;
    took: number;
    error?: string;
    engine: string;
    max_score?: number;
    sample_results?: Array<{
      id: number;
      transcript_text: string;
      speaker_name: string;
      video_title?: string;
      similarity_score?: number;
    }>;
  };
}

interface SearchEngineComparisonProps {
  initialQuery?: string;
  compact?: boolean;
}

const SearchEngineComparison: React.FC<SearchEngineComparisonProps> = ({ 
  initialQuery = '', 
  compact = false 
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [showDetails, setShowDetails] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult | null>(null);

  const compareEnginesMutation = useMutation({
    mutationFn: (searchQuery: string) => searchAPI.compareEngines(searchQuery, 5),
    onSuccess: (data) => {
      setComparisonResults(data as ComparisonResult);
    },
    onError: (error) => {
      console.error('Engine comparison failed:', error);
    },
  });

  const handleCompare = () => {
    if (query.trim()) {
      compareEnginesMutation.mutate(query.trim());
    }
  };

  const getEngineIcon = (engine: string) => {
    return engine === 'elasticsearch' ? (
      <Database className="h-4 w-4 text-blue-500" />
    ) : (
      <Zap className="h-4 w-4 text-green-500" />
    );
  };

  const getEngineColor = (engine: string) => {
    return engine === 'elasticsearch' 
      ? 'bg-blue-50 border-blue-200 text-blue-800' 
      : 'bg-green-50 border-green-200 text-green-800';
  };

  const getWinnerIndicator = (engine: string, metric: 'speed' | 'results') => {
    if (!comparisonResults) return null;
    
    const engines = Object.keys(comparisonResults);
    if (engines.length !== 2) return null;
    
    const [engine1, engine2] = engines;
    const result1 = comparisonResults[engine1];
    const result2 = comparisonResults[engine2];
    
    // Skip if either has errors
    if (result1.error || result2.error) return null;
    
    let winner: string;
    if (metric === 'speed') {
      winner = result1.took < result2.took ? engine1 : engine2;
    } else {
      winner = result1.total > result2.total ? engine1 : engine2;
    }
    
    return winner === engine ? (
      <span className="ml-2 text-green-600 font-medium">🏆 Winner</span>
    ) : null;
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter query to compare engines..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
          />
          <button
            onClick={handleCompare}
            disabled={!query.trim() || compareEnginesMutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {compareEnginesMutation.isPending ? 'Comparing...' : 'Compare'}
          </button>
        </div>
        
        {comparisonResults && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(comparisonResults).map(([engine, result]) => (
              <div key={engine} className={`p-3 rounded border ${getEngineColor(engine)}`}>
                <div className="flex items-center mb-2">
                  {getEngineIcon(engine)}
                  <span className="ml-2 font-medium capitalize">{engine}</span>
                </div>
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
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Search Engine Comparison
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Compare performance and results between Elasticsearch and Meilisearch
        </p>
      </div>

      <div className="p-6">
        {/* Search Input */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search query to compare engines..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
              />
            </div>
            <button
              onClick={handleCompare}
              disabled={!query.trim() || compareEnginesMutation.isPending}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center"
            >
              {compareEnginesMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Comparing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Compare
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {comparisonResults && (
          <div className="space-y-6">
            {/* Performance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(comparisonResults).map(([engine, result]) => (
                <div key={engine} className={`rounded-lg border-2 p-4 ${getEngineColor(engine)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {getEngineIcon(engine)}
                      <span className="ml-2 font-semibold text-lg capitalize">{engine}</span>
                    </div>
                    {result.error ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>

                  {result.error ? (
                    <div className="text-red-600">
                      <p className="font-medium">Error occurred:</p>
                      <p className="text-sm mt-1">{result.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Hash className="h-4 w-4 mr-2" />
                          <span>Results Found</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-bold text-lg">{result.total.toLocaleString()}</span>
                          {getWinnerIndicator(engine, 'results')}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>Response Time</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-bold text-lg">{result.took}ms</span>
                          {getWinnerIndicator(engine, 'speed')}
                        </div>
                      </div>

                      {result.max_score && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            <span>Max Score</span>
                          </div>
                          <span className="font-bold">{result.max_score.toFixed(3)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sample Results */}
            {!compareEnginesMutation.isPending && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center text-gray-700 hover:text-gray-900 font-medium"
                >
                  <span>Sample Results</span>
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </button>

                {showDetails && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(comparisonResults).map(([engine, result]) => (
                      <div key={engine}>
                        <h4 className="font-medium mb-3 capitalize flex items-center">
                          {getEngineIcon(engine)}
                          <span className="ml-2">{engine} Sample Results</span>
                        </h4>
                        
                        {result.error ? (
                          <p className="text-red-600 text-sm">Unable to load sample results due to error</p>
                        ) : result.sample_results && result.sample_results.length > 0 ? (
                          <div className="space-y-3">
                            {result.sample_results.slice(0, 3).map((sample, idx) => (
                              <div key={sample.id} className="bg-white p-3 rounded border">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {sample.speaker_name || 'Unknown Speaker'}
                                  </span>
                                  {sample.similarity_score && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      Score: {sample.similarity_score.toFixed(3)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 line-clamp-2">
                                  {sample.transcript_text.length > 150 
                                    ? `${sample.transcript_text.substring(0, 150)}...` 
                                    : sample.transcript_text}
                                </p>
                                {sample.video_title && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    From: {sample.video_title}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No sample results available</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchEngineComparison;