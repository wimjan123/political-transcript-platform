import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, 
  Calendar, User, Tag, TrendingUp, AlertCircle, Clock,
  ExternalLink, Play
} from 'lucide-react';
import { searchAPI, downloadFile, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import type { SearchResponse, SearchParams, FilterState, TranscriptSegment } from '../types';

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<FilterState>({
    speaker: searchParams.get('speaker') || '',
    source: searchParams.get('source') || '',
    topic: searchParams.get('topic') || '',
    dateFrom: searchParams.get('date_from') || '',
    dateTo: searchParams.get('date_to') || '',
    sentiment: searchParams.get('sentiment') || '',
    minReadability: searchParams.get('min_readability') ? parseFloat(searchParams.get('min_readability')!) : '',
    maxReadability: searchParams.get('max_readability') ? parseFloat(searchParams.get('max_readability')!) : '',
    searchType: (searchParams.get('search_type') as FilterState['searchType']) || 'fulltext',
    sortBy: (searchParams.get('sort_by') as FilterState['sortBy']) || 'relevance',
    sortOrder: (searchParams.get('sort_order') as FilterState['sortOrder']) || 'desc',
  });
  
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '25'));

  useEffect(() => {
    if (query.trim()) {
      performSearch();
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      performSearch();
    }
  }, [searchParams]);

  const performSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchParameters: SearchParams = {
        q: query,
        page: currentPage,
        page_size: pageSize,
        search_type: filters.searchType,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        ...Object.fromEntries(
          Object.entries(filters).filter(([key, value]) => 
            value !== '' && !['searchType', 'sortBy', 'sortOrder'].includes(key)
          )
        )
      };

      const results = await searchAPI.search(searchParameters);
      setSearchResults(results);

      // Update URL
      const newParams = new URLSearchParams();
      Object.entries(searchParameters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined) {
          newParams.set(key, value.toString());
        }
      });
      setSearchParams(newParams);

    } catch (error) {
      console.error('Search failed:', error);
      setError('Failed to perform search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    performSearch();
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      speaker: '',
      source: '',
      topic: '',
      dateFrom: '',
      dateTo: '',
      sentiment: '',
      minReadability: '',
      maxReadability: '',
      searchType: 'fulltext',
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!searchResults || !query.trim()) return;

    setIsExporting(true);
    try {
      const searchParameters: SearchParams = {
        q: query,
        search_type: filters.searchType,
        ...Object.fromEntries(
          Object.entries(filters).filter(([key, value]) => 
            value !== '' && !['searchType', 'sortBy', 'sortOrder'].includes(key)
          )
        )
      };

      const blob = await searchAPI.exportResults(searchParameters, format);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      downloadFile(blob, `search-results-${timestamp}.${format}`);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export results. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSegmentExpansion = (segmentId: number) => {
    setExpandedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
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

  const renderSegment = (segment: TranscriptSegment) => {
    const isExpanded = expandedSegments.has(segment.id);
    const sentimentColor = getSentimentColor(segment.sentiment_loughran_score);
    const sentimentLabel = getSentimentLabel(segment.sentiment_loughran_score);

    return (
      <div key={segment.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">{segment.speaker_name}</span>
              </div>
              
              {segment.video && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{segment.video.date}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{formatTimestamp(segment.video_seconds)}</span>
                {segment.timestamp_start && segment.timestamp_end && (
                  <span>({segment.timestamp_start}-{segment.timestamp_end})</span>
                )}
              </div>
            </div>

            {/* Video Info */}
            {segment.video && (
              <div className="text-sm text-gray-600 mb-2">
                <span className="font-medium">{segment.video.title}</span>
                {segment.video.source && (
                  <span className="ml-2 badge badge-blue">{segment.video.source}</span>
                )}
              </div>
            )}

            {/* Transcript Text */}
            <div className="text-gray-900 mb-4 leading-relaxed">
              {highlightText(segment.transcript_text, query)}
            </div>

            {/* Metadata Row */}
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
              <span>{segment.word_count} words</span>
              
              {typeof segment.sentiment_loughran_score === 'number' && (
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className={sentimentColor}>{sentimentLabel}</span>
                </div>
              )}
              
              {typeof segment.flesch_kincaid_grade === 'number' && (
                <span>Grade: {segment.flesch_kincaid_grade.toFixed(1)}</span>
              )}
            </div>

            {/* Topics */}
            {segment.segment_topics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {segment.segment_topics.map((segmentTopic) => (
                  <span 
                    key={segmentTopic.topic.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {segmentTopic.topic.name}
                    {segmentTopic.score && (
                      <span className="ml-1 text-green-600">({segmentTopic.score.toFixed(2)})</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleSegmentExpansion(segment.id)}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Detailed Sentiment Analysis */}
            {(typeof segment.sentiment_loughran_score === 'number' || 
              typeof segment.sentiment_harvard_score === 'number' || 
              typeof segment.sentiment_vader_score === 'number') && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Sentiment Analysis</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {typeof segment.sentiment_loughran_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loughran-McDonald:</span>
                      <span className={getSentimentColor(segment.sentiment_loughran_score)}>
                        {segment.sentiment_loughran_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {typeof segment.sentiment_harvard_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Harvard-IV:</span>
                      <span className={getSentimentColor(segment.sentiment_harvard_score)}>
                        {segment.sentiment_harvard_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {typeof segment.sentiment_vader_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">VADER:</span>
                      <span className={getSentimentColor(segment.sentiment_vader_score)}>
                        {segment.sentiment_vader_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Readability Metrics */}
            {(typeof segment.flesch_kincaid_grade === 'number' || 
              typeof segment.flesch_reading_ease === 'number' ||
              typeof segment.gunning_fog_index === 'number') && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Readability Metrics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {typeof segment.flesch_kincaid_grade === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Flesch-Kincaid Grade:</span>
                      <span className="text-gray-900">{segment.flesch_kincaid_grade.toFixed(1)}</span>
                    </div>
                  )}
                  {typeof segment.flesch_reading_ease === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reading Ease:</span>
                      <span className="text-gray-900">{segment.flesch_reading_ease.toFixed(1)}</span>
                    </div>
                  )}
                  {typeof segment.gunning_fog_index === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gunning Fog:</span>
                      <span className="text-gray-900">{segment.gunning_fog_index.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Moderation */}
            {segment.moderation_overall_score !== undefined && segment.moderation_overall_score > 0.1 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Content Moderation</h4>
                <div className="flex items-center space-x-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-gray-600">Overall Score:</span>
                  <span className="text-amber-600 font-medium">
                    {(segment.moderation_overall_score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {segment.video && (
                <button className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors">
                  <Play className="h-4 w-4 mr-1" />
                  Play Clip
                </button>
              )}
              <button className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors">
                <ExternalLink className="h-4 w-4 mr-1" />
                View Context
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Main Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search transcripts, speakers, topics..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mr-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
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
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                {showFilters ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-2" />}
              </button>

              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                
                {searchResults && searchResults.results.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={isExporting}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={isExporting}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                    >
                      Export JSON
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Speaker Filter */}
                  <div>
                    <label className="label">Speaker</label>
                    <input
                      type="text"
                      value={filters.speaker}
                      onChange={(e) => handleFilterChange('speaker', e.target.value)}
                      className="input"
                      placeholder="Filter by speaker name..."
                    />
                  </div>

                  {/* Source Filter */}
                  <div>
                    <label className="label">Source</label>
                    <input
                      type="text"
                      value={filters.source}
                      onChange={(e) => handleFilterChange('source', e.target.value)}
                      className="input"
                      placeholder="Filter by source..."
                    />
                  </div>

                  {/* Topic Filter */}
                  <div>
                    <label className="label">Topic</label>
                    <input
                      type="text"
                      value={filters.topic}
                      onChange={(e) => handleFilterChange('topic', e.target.value)}
                      className="input"
                      placeholder="Filter by topic..."
                    />
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="label">From Date</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      className="input"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="label">To Date</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      className="input"
                    />
                  </div>

                  {/* Sentiment */}
                  <div>
                    <label className="label">Sentiment</label>
                    <select
                      value={filters.sentiment}
                      onChange={(e) => handleFilterChange('sentiment', e.target.value)}
                      className="input"
                    >
                      <option value="">Any sentiment</option>
                      <option value="positive">Positive</option>
                      <option value="negative">Negative</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                </div>

                {/* Search Type and Sorting */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Search Type</label>
                    <select
                      value={filters.searchType}
                      onChange={(e) => handleFilterChange('searchType', e.target.value)}
                      className="input"
                    >
                      <option value="fulltext">Full-text Search</option>
                      <option value="exact">Exact Match</option>
                      <option value="fuzzy">Fuzzy Search</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      className="input"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Date</option>
                      <option value="speaker">Speaker</option>
                      <option value="sentiment">Sentiment</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Sort Order</label>
                    <select
                      value={filters.sortOrder}
                      onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                      className="input"
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  Search Results
                </h2>
                <p className="text-sm text-gray-500">
                  {searchResults.total.toLocaleString()} results for "{searchResults.query}"
                  {searchResults.total > 0 && (
                    <span>
                      {' '}• Showing {((searchResults.page - 1) * searchResults.page_size) + 1}-
                      {Math.min(searchResults.page * searchResults.page_size, searchResults.total)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-4 mb-8">
              {searchResults.results.map(renderSegment)}
            </div>

            {/* Pagination */}
            {searchResults.total_pages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {searchResults.page} of {searchResults.total_pages}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(searchResults.total_pages, currentPage + 1))}
                    disabled={currentPage === searchResults.total_pages}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {searchResults && searchResults.results.length === 0 && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}

        {/* Initial State */}
        {!searchResults && !isLoading && !query && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Start searching</h3>
            <p className="mt-1 text-sm text-gray-500">
              Enter a search query above to find relevant transcript segments
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
