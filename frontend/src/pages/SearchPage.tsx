import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, 
  Calendar, User, Tag, TrendingUp, AlertCircle, Clock,
  ExternalLink, Play, Plus, MessageSquare
} from 'lucide-react';
import { playlist } from '../services/playlist';
import { searchAPI, downloadFile, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import useDebounce from '../hooks/useDebounce';
import { useSmartSearch } from '../hooks/useSearch';
import LanguageSelector, { SUPPORTED_LANGUAGES } from '../components/LanguageSelector';
import { SearchResultsSkeleton } from '../components/SkeletonLoader';
import VirtualizedSearchResults from '../components/VirtualizedSearchResults';
import type { SearchResponse, SearchParams, FilterState, TranscriptSegment } from '../types';

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<FilterState>({
    speaker: searchParams.get('speaker') || '',
    source: searchParams.get('source') || '',
    dataset: (searchParams.get('dataset') || 'all'),
    topic: searchParams.get('topic') || '',
    dateFrom: searchParams.get('date_from') || '',
    dateTo: searchParams.get('date_to') || '',
    sentiment: searchParams.get('sentiment') || '',
    minReadability: searchParams.get('min_readability') ? parseFloat(searchParams.get('min_readability')!) : '',
    maxReadability: searchParams.get('max_readability') ? parseFloat(searchParams.get('max_readability')!) : '',
    
    // Event metadata filters
    format: searchParams.get('format') || '',
    candidate: searchParams.get('candidate') || '',
    place: searchParams.get('place') || '',
    recordType: searchParams.get('record_type') || '',
    
    // Stresslens filters
    minStresslens: searchParams.get('min_stresslens') ? parseFloat(searchParams.get('min_stresslens')!) : '',
    maxStresslens: searchParams.get('max_stresslens') ? parseFloat(searchParams.get('max_stresslens')!) : '',
    stresslensRank: searchParams.get('stresslens_rank') ? parseInt(searchParams.get('stresslens_rank')!) : '',
    
    // Moderation flags
    hasHarassment: searchParams.get('has_harassment') === 'true',
    hasHate: searchParams.get('has_hate') === 'true',
    hasViolence: searchParams.get('has_violence') === 'true',
    hasSexual: searchParams.get('has_sexual') === 'true',
    hasSelfharm: searchParams.get('has_selfharm') === 'true',
    
    searchType: (searchParams.get('search_type') as FilterState['searchType']) || 'fulltext',
    sortBy: (searchParams.get('sort_by') as FilterState['sortBy']) || 'relevance',
    sortOrder: (searchParams.get('sort_order') as FilterState['sortOrder']) || 'desc',
    similarityThreshold: searchParams.get('similarity_threshold') ? parseFloat(searchParams.get('similarity_threshold')!) : 0.5,
  });
  
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '25'));

  // Meilisearch toggles
  const [searchEngine, setSearchEngine] = useState<'postgres' | 'meili'>((searchParams.get('engine') as any) || 'postgres');
  const [meiliMode, setMeiliMode] = useState<'lexical' | 'hybrid' | 'semantic'>((searchParams.get('mode') as any) || 'lexical');
  const [meiliIndex, setMeiliIndex] = useState<'segments' | 'events'>((searchParams.get('index') as any) || 'segments');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(searchParams.get('language') || 'auto');
  
  // Selection + export state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<number>>(new Set());

  // Search-as-you-type with debouncing - optimized to 200ms for snappier UX
  const debouncedQuery = useDebounce(query, 200);
  const [isTyping, setIsTyping] = useState(false);
  
  // Prepare search parameters for TanStack Query
  const searchParameters = React.useMemo((): SearchParams & {
    engine?: 'postgres' | 'meili';
    mode?: 'lexical' | 'hybrid' | 'semantic';
    index?: 'segments' | 'events';
    similarity_threshold?: number;
    locales?: string[];
  } => {
    const mappedFilters: Record<string, any> = {};
    const add = (k: string, v: any) => { if (v !== '' && v !== undefined) mappedFilters[k] = v; };
    
    add('speaker', filters.speaker);
    add('source', filters.source);
    if (filters.dataset && filters.dataset !== 'all') add('dataset', filters.dataset);
    add('topic', filters.topic);
    add('date_from', filters.dateFrom);
    add('date_to', filters.dateTo);
    add('sentiment', filters.sentiment);
    add('min_readability', filters.minReadability);
    add('max_readability', filters.maxReadability);
    add('format', filters.format);
    add('candidate', filters.candidate);
    add('place', filters.place);
    add('record_type', filters.recordType);
    add('min_stresslens', filters.minStresslens);
    add('max_stresslens', filters.maxStresslens);
    add('stresslens_rank', filters.stresslensRank);
    add('has_harassment', filters.hasHarassment ? true : undefined);
    add('has_hate', filters.hasHate ? true : undefined);
    add('has_violence', filters.hasViolence ? true : undefined);
    add('has_sexual', filters.hasSexual ? true : undefined);
    add('has_selfharm', filters.hasSelfharm ? true : undefined);

    return {
      q: debouncedQuery,
      page: currentPage,
      page_size: pageSize,
      search_type: filters.searchType,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      engine: searchEngine,
      mode: meiliMode,
      index: meiliIndex,
      similarity_threshold: filters.similarityThreshold !== '' ? Number(filters.similarityThreshold) : undefined,
      locales: selectedLanguage !== 'auto' ? [selectedLanguage] : undefined,
      ...mappedFilters,
    };
  }, [
    debouncedQuery, currentPage, pageSize, filters, searchEngine, meiliMode, 
    meiliIndex, selectedLanguage
  ]);

  // Use the smart search hook with TanStack Query
  const {
    data: searchResults,
    isLoading,
    error,
    isFetching,
  } = useSmartSearch(searchParameters, !!debouncedQuery.trim());
  

  const vimeoTimeFragment = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join('');
  };

  const buildWatchUrlAt = (segment: TranscriptSegment) => {
    const v = segment.video;
    if (!v || typeof segment.video_seconds !== 'number') return undefined;
    const base = v.vimeo_video_id ? `https://vimeo.com/${v.vimeo_video_id}` : (v.vimeo_embed_url || v.video_url);
    if (!base) return undefined;
    const frag = vimeoTimeFragment(segment.video_seconds);
    if (base.includes('vimeo.com')) return `${base}#t=${frag}`;
    return base;
  };

  const toggleSelectSegment = useCallback((id: number) => {
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = () => {
    if (!searchResults) return;
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      searchResults.results.forEach(s => next.add(s.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedSegmentIds(new Set());

  // Memoize selected segments filtering for performance
  const selectedSegments = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.results.filter(s => selectedSegmentIds.has(s.id));
  }, [searchResults, selectedSegmentIds]);

  // Memoize search type display text for performance
  const searchTypeDisplay = useMemo(() => {
    if (filters.searchType === 'semantic') return '🧠 Semantic';
    if (filters.searchType === 'fulltext') return '🔍 Full-text';
    if (filters.searchType === 'exact') return '🎯 Exact';
    return '🔄 Fuzzy';
  }, [filters.searchType]);

  // Memoize results summary for performance
  const resultsSummary = useMemo(() => {
    if (!searchResults) return '';
    return `${searchResults.total.toLocaleString()} results for "${searchResults.query}"`;
  }, [searchResults]);

  // Memoize pagination display for performance
  const paginationDisplay = useMemo(() => {
    if (!searchResults || searchResults.total === 0) return null;
    const start = ((searchResults.page - 1) * searchResults.page_size) + 1;
    const end = Math.min(searchResults.page * searchResults.page_size, searchResults.total);
    return `• Showing ${start}-${end}`;
  }, [searchResults]);

  const exportSelectedTxt = () => {
    if (selectedSegments.length === 0) return;
    const lines = selectedSegments.map(s => {
      const ts = typeof s.video_seconds === 'number' ? formatTimestamp(s.video_seconds) : '';
      const start = ts ? `[${ts}]` : '';
      const dateStr = s.video?.date ? `[${new Date(s.video.date).toISOString().slice(0,10)}]` : '';
      const placeStr = s.video?.place ? `[${s.video.place}]` : '';
      const headerBits = [dateStr, placeStr, start].filter(Boolean).join(' ');
      const speaker = s.speaker_name || 'Unknown';
      const videoInfo = s.video?.title ? ` — ${s.video.title}` : '';
      return `${headerBits} ${speaker}: ${s.transcript_text}${videoInfo}`.trim();
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const filename = `search_segments_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    downloadFile(blob as unknown as Blob, filename);
  };

  const exportSelectedWithLinks = () => {
    if (selectedSegments.length === 0) return;
    const lines = selectedSegments.map(s => {
      const start = typeof s.video_seconds === 'number' ? formatTimestamp(s.video_seconds) : '';
      const end = (typeof s.video_seconds === 'number' && typeof s.duration_seconds === 'number') 
        ? formatTimestamp(s.video_seconds + s.duration_seconds) : undefined;
      const range = end ? `[${start} - ${end}]` : (start ? `[${start}]` : '');
      const dateStr = s.video?.date ? `[${new Date(s.video.date).toISOString().slice(0,10)}]` : '';
      const placeStr = s.video?.place ? `[${s.video.place}]` : '';
      const headerBits = [dateStr, placeStr, range].filter(Boolean).join(' ');
      const speaker = s.speaker_name || 'Unknown';
      const videoInfo = s.video?.title ? ` — ${s.video.title}` : '';
      const url = buildWatchUrlAt(s) || '';
      return `${headerBits} ${speaker}: ${s.transcript_text}${videoInfo}\n${url}`.trim();
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const filename = `search_segments_links_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    downloadFile(blob as unknown as Blob, filename);
  };


  // Handle initial query from URL
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [searchParams]);



  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      speaker: '',
      source: '',
      dataset: 'all',
      topic: '',
      dateFrom: '',
      dateTo: '',
      sentiment: '',
      minReadability: '',
      maxReadability: '',
      
      // Event metadata filters
      format: '',
      candidate: '',
      place: '',
      recordType: '',
      
      // Stresslens filters
      minStresslens: '',
      maxStresslens: '',
      stresslensRank: '',
      
      // Moderation flags
      hasHarassment: false,
      hasHate: false,
      hasViolence: false,
      hasSexual: false,
      hasSelfharm: false,
      
      searchType: 'fulltext',
      sortBy: 'relevance',
      sortOrder: 'desc',
      similarityThreshold: 0.5,
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
      // TODO: Show user-friendly error notification
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSegmentExpansion = useCallback((segmentId: number) => {
    setExpandedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  }, []);



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-8 dark:bg-gray-800/70 dark:border-gray-700">
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Main Search Input */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsTyping(true);
                }}
                className="block w-full pl-12 pr-28 py-4 border border-gray-300/50 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 dark:bg-gray-800/70 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Search transcripts, speakers, topics..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-3 sm:px-6 py-2.5 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Searching...
                    </>
                  ) : (
                    <span className="hidden sm:inline">Search</span>
                  )}
                </button>
              </div>
            </div>

            {/* Search Engine + Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Search Engine</label>
                <select
                  value={searchEngine}
                  onChange={(e) => setSearchEngine(e.target.value as any)}
                  className="input"
                >
                  <option value="postgres">Database (Postgres)</option>
                  <option value="meili">Meilisearch</option>
                </select>
              </div>
              {searchEngine === 'meili' && (
                <>
                  <div>
                    <label className="label">Meili Mode</label>
                    <select
                      value={meiliMode}
                      onChange={(e) => setMeiliMode(e.target.value as any)}
                      className="input"
                    >
                      <option value="lexical">Lexical</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="semantic">Semantic</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Meili Index</label>
                    <select
                      value={meiliIndex}
                      onChange={(e) => setMeiliIndex(e.target.value as any)}
                      className="input"
                    >
                      <option value="segments">Segments</option>
                      <option value="events">Events</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Language Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  showLabel={true}
                />
              </div>
              <div className="text-xs text-gray-500 pt-7 dark:text-gray-400">
                Language selection helps improve search accuracy when using Meilisearch semantic or hybrid modes.
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                {showFilters ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-2" />}
              </button>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                
                {searchResults && searchResults.results.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectionMode(!selectionMode)}
                      className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${selectionMode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'} hover:bg-gray-50 dark:hover:bg-gray-700`}
                    >
                      {selectionMode ? 'Exit Selection' : 'Select Segments'}
                    </button>
                    {selectionMode && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={selectAllVisible} className="btn btn-outline text-xs sm:text-sm px-2 sm:px-3">Select Page</button>
                        <button type="button" onClick={clearSelection} className="btn btn-outline text-xs sm:text-sm px-2 sm:px-3">Clear</button>
                        <button type="button" onClick={exportSelectedTxt} className="btn btn-primary text-xs sm:text-sm px-2 sm:px-3">Export Text</button>
                        <button type="button" onClick={exportSelectedWithLinks} className="btn btn-primary text-xs sm:text-sm px-2 sm:px-3">Export + Links</button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleExport('csv')}
                        disabled={isExporting}
                        className="inline-flex items-center px-2 sm:px-3 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                        <span className="sm:hidden">CSV</span>
                      </button>
                      <button
                        onClick={() => handleExport('json')}
                        disabled={isExporting}
                        className="inline-flex items-center px-2 sm:px-3 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                      >
                        <span className="hidden sm:inline">Export JSON</span>
                        <span className="sm:hidden">JSON</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200 space-y-4 dark:border-gray-700">
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

                  {/* Dataset Filter */}
                  <div>
                    <label className="label">Dataset</label>
                    <select
                      value={filters.dataset}
                      onChange={(e) => handleFilterChange('dataset', e.target.value)}
                      className="input"
                    >
                      <option value="all">All</option>
                      <option value="trump">Trump</option>
                      <option value="tweede_kamer">Tweede Kamer</option>
                    </select>
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

                {/* Event Metadata Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Format Filter */}
                  <div>
                    <label className="label">Format</label>
                    <input
                      type="text"
                      value={filters.format}
                      onChange={(e) => handleFilterChange('format', e.target.value)}
                      className="input"
                      placeholder="Event format..."
                    />
                  </div>

                  {/* Candidate Filter */}
                  <div>
                    <label className="label">Candidate</label>
                    <input
                      type="text"
                      value={filters.candidate}
                      onChange={(e) => handleFilterChange('candidate', e.target.value)}
                      className="input"
                      placeholder="Candidate name..."
                    />
                  </div>

                  {/* Place Filter */}
                  <div>
                    <label className="label">Place</label>
                    <input
                      type="text"
                      value={filters.place}
                      onChange={(e) => handleFilterChange('place', e.target.value)}
                      className="input"
                      placeholder="Event location..."
                    />
                  </div>

                  {/* Record Type Filter */}
                  <div>
                    <label className="label">Record Type</label>
                    <input
                      type="text"
                      value={filters.recordType}
                      onChange={(e) => handleFilterChange('recordType', e.target.value)}
                      className="input"
                      placeholder="Record type..."
                    />
                  </div>
                </div>

                {/* Stresslens Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Min Stresslens */}
                  <div>
                    <label className="label">Min Stresslens Score</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max="1"
                      value={filters.minStresslens}
                      onChange={(e) => handleFilterChange('minStresslens', e.target.value ? parseFloat(e.target.value) : '')}
                      className="input"
                      placeholder="0.000"
                    />
                  </div>

                  {/* Max Stresslens */}
                  <div>
                    <label className="label">Max Stresslens Score</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max="1"
                      value={filters.maxStresslens}
                      onChange={(e) => handleFilterChange('maxStresslens', e.target.value ? parseFloat(e.target.value) : '')}
                      className="input"
                      placeholder="1.000"
                    />
                  </div>

                  {/* Stresslens Rank */}
                  <div>
                    <label className="label">Stresslens Rank</label>
                    <input
                      type="number"
                      min="1"
                      value={filters.stresslensRank}
                      onChange={(e) => handleFilterChange('stresslensRank', e.target.value ? parseInt(e.target.value) : '')}
                      className="input"
                      placeholder="Rank number..."
                    />
                  </div>
                </div>

                {/* Moderation Flags */}
                <div>
                  <label className="label">Content Moderation Flags</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasHarassment"
                        checked={filters.hasHarassment}
                        onChange={(e) => handleFilterChange('hasHarassment', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasHarassment" className="ml-2 text-sm text-gray-700">Harassment</label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasHate"
                        checked={filters.hasHate}
                        onChange={(e) => handleFilterChange('hasHate', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasHate" className="ml-2 text-sm text-gray-700">Hate</label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasViolence"
                        checked={filters.hasViolence}
                        onChange={(e) => handleFilterChange('hasViolence', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasViolence" className="ml-2 text-sm text-gray-700">Violence</label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasSexual"
                        checked={filters.hasSexual}
                        onChange={(e) => handleFilterChange('hasSexual', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasSexual" className="ml-2 text-sm text-gray-700">Sexual</label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasSelfharm"
                        checked={filters.hasSelfharm}
                        onChange={(e) => handleFilterChange('hasSelfharm', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasSelfharm" className="ml-2 text-sm text-gray-700">Self-harm</label>
                    </div>
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
                      <option value="semantic">Semantic Search</option>
                    </select>
                  </div>

                  {filters.searchType === 'semantic' && (
                    <div>
                      <label className="label">
                        Similarity Threshold
                        <span className="text-sm text-gray-500 ml-2">(0.0 - 1.0)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={filters.similarityThreshold}
                        onChange={(e) => handleFilterChange('similarityThreshold', parseFloat(e.target.value) || 0.5)}
                        className="input"
                        placeholder="0.5"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Higher values return more similar results. Lower values cast a wider net.
                      </p>
                    </div>
                  )}

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
                      <option value="stresslens">Stresslens</option>
                      {filters.searchType === 'semantic' && (
                        <option value="similarity">Similarity Score</option>
                      )}
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
              <span className="text-red-700">{error.message}</span>
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
                  {resultsSummary}
                  <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    {searchTypeDisplay}
                  </span>
                  {paginationDisplay && (
                    <span>
                      {' '}{paginationDisplay}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Results List - Virtualized for Performance */}
            <div className="mb-8">
              <VirtualizedSearchResults
                results={searchResults.results}
                query={query}
                expandedSegments={expandedSegments}
                onToggleExpansion={toggleSegmentExpansion}
                selectedSegmentIds={selectedSegmentIds}
                onToggleSelect={toggleSelectSegment}
                selectionMode={selectionMode}
                containerHeight={800} // Adjust based on your design needs
              />
            </div>

            {/* Pagination */}
            {searchResults.total_pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Page {searchResults.page} of {searchResults.total_pages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(searchResults.total_pages, currentPage + 1))}
                    disabled={currentPage === searchResults.total_pages}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
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
