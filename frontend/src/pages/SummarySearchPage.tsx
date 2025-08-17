import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Calendar, Bot, FileText, ChevronLeft, ChevronRight, ExternalLink, Clock, BarChart3, TrendingUp, Users } from 'lucide-react';
import { summaryAPI } from '../services/api';
import useDebounce from '../hooks/useDebounce';

interface SummarySearchResult {
  id: number;
  video_id: number;
  video_title: string;
  video_date: string | null;
  summary_text: string;
  bullet_points: number;
  provider: string;
  model: string;
  generated_at: string;
  metadata: any;
}

interface SummarySearchResponse {
  results: SummarySearchResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  query: string;
}

const SummarySearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SummarySearchResponse | null>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '25'));

  const debouncedQuery = useDebounce(query, 300);

  // Load summary stats on component mount
  useEffect(() => {
    loadSummaryStats();
  }, []);

  // Load overview or perform search based on query
  useEffect(() => {
    if (debouncedQuery.trim()) {
      performSearch();
    } else {
      loadOverview();
    }
  }, [debouncedQuery, currentPage, pageSize]);

  const loadSummaryStats = async () => {
    setIsStatsLoading(true);
    try {
      const stats = await summaryAPI.getStats();
      setSummaryStats(stats);
    } catch (error) {
      console.error('Failed to load summary stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const loadOverview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all summaries with a placeholder search to get all results
      const overviewResults = await summaryAPI.searchSummaries('', currentPage, pageSize);
      setResults(overviewResults);
    } catch (error: any) {
      console.error('Failed to load overview:', error);
      setError('Failed to load summaries overview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [searchParams]);

  const performSearch = async () => {
    if (!debouncedQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await summaryAPI.searchSummaries(debouncedQuery, currentPage, pageSize);
      setResults(searchResults);

      // Update URL
      const newParams = new URLSearchParams();
      newParams.set('q', debouncedQuery);
      newParams.set('page', currentPage.toString());
      newParams.set('page_size', pageSize.toString());
      setSearchParams(newParams);
    } catch (error: any) {
      console.error('Search failed:', error);
      setError('Failed to search summaries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    performSearch();
  };

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
      ) : part
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'openrouter':
        return '🔀';
      default:
        return '⚡';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Summary Search</h1>
          <p className="text-gray-600">Search through AI-generated video summaries</p>
        </div>

        {/* Summary Stats Overview */}
        {!query && summaryStats && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Summaries</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {results?.total?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Videos with Transcripts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summaryStats.videos_with_transcripts?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Bot className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Segments/Video</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summaryStats.average_segments_per_video?.toFixed(1) || '0'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 border border-gray-300/50 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300"
                placeholder="Search summaries by content, video title, or description..."
              />
            </div>

            <div className="flex items-center justify-between">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">⚠️</div>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {results.query ? 'Search Results' : 'All Summaries'}
                </h2>
                <p className="text-sm text-gray-500">
                  {results.query ? (
                    <>
                      {results.total.toLocaleString()} summaries found for "{results.query}"
                      {results.total > 0 && (
                        <span>
                          {' '}• Showing {((results.page - 1) * results.page_size) + 1}-
                          {Math.min(results.page * results.page_size, results.total)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {results.total.toLocaleString()} total summaries
                      {results.total > 0 && (
                        <span>
                          {' '}• Showing {((results.page - 1) * results.page_size) + 1}-
                          {Math.min(results.page * results.page_size, results.total)}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-6 mb-8">
              {results.results.map((summary) => (
                <div key={summary.id} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl hover:border-blue-300/50 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {/* Video Title */}
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <Link
                          to={`/videos/${summary.video_id}`}
                          className="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {highlightText(summary.video_title, query)}
                        </Link>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(summary.video_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Bot className="h-4 w-4" />
                          <span>{getProviderIcon(summary.provider)} {summary.model}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Generated {formatDateTime(summary.generated_at)}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {summary.bullet_points} points
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Content */}
                  <div className="prose prose-sm max-w-none">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {highlightText(summary.summary_text, query)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {results.total_pages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {results.page} of {results.total_pages}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(results.total_pages, currentPage + 1))}
                    disabled={currentPage === results.total_pages}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {results && results.results.length === 0 && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {results.query ? 'No summaries found' : 'No summaries available'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {results.query
                ? 'Try adjusting your search terms or check if summaries have been generated for videos'
                : 'No video summaries have been generated yet. Visit the Videos page to create summaries.'
              }
            </p>
          </div>
        )}

        {/* Loading State */}
        {!results && isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {query ? 'Searching summaries...' : 'Loading summaries...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummarySearchPage;