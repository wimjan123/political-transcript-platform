import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, 
  Calendar, User, Tag, TrendingUp, AlertCircle, Clock,
  ExternalLink, Play, Plus, MessageSquare, Bot
} from 'lucide-react';
import { playlist } from '../services/playlist';
import { searchAPI, downloadFile, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import useDebounce from '../hooks/useDebounce';
import LanguageSelector, { SUPPORTED_LANGUAGES } from '../components/LanguageSelector';
import ChatSearchModal from '../components/ChatSearchModal';
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

  // Search-as-you-type with debouncing
  const debouncedQuery = useDebounce(query, 300);
  const [isTyping, setIsTyping] = useState(false);
  
  // Chat search modal
  const [chatModalOpen, setChatModalOpen] = useState(false);

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

  const toggleSelectSegment = (id: number) => {
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (!searchResults) return;
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      searchResults.results.forEach(s => next.add(s.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedSegmentIds(new Set());

  const exportSelectedTxt = () => {
    if (!searchResults) return;
    const selected = searchResults.results.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    const lines = selected.map(s => {
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
    if (!searchResults) return;
    const selected = searchResults.results.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    const lines = selected.map(s => {
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

  // Search-as-you-type: trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim() && !isTyping) {
      setCurrentPage(1); // Reset to first page for new search
      performSearch();
    } else if (!debouncedQuery.trim()) {
      setSearchResults(null); // Clear results when query is empty
    }
    setIsTyping(false);
  }, [debouncedQuery]);

  const performSearch = async () => {
    const searchQuery = debouncedQuery.trim() || query.trim();
    if (!searchQuery) return;

    setIsLoading(true);
    setError(null);

    try {
      // Map UI filter keys (camelCase) to API params (snake_case)
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

      const searchParameters: SearchParams = {
        q: searchQuery,
        page: currentPage,
        page_size: pageSize,
        search_type: filters.searchType,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        ...mappedFilters,
      };

      let results: SearchResponse;
      if (searchEngine === 'meili') {
        const meiliParams: any = {
          ...searchParameters,
          mode: meiliMode,
          index: meiliIndex,
        };
        
        // Add locales parameter if a specific language is selected
        if (selectedLanguage !== 'auto') {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);
          if (lang && lang.iso639) {
            meiliParams.locales = lang.iso639;
          }
        }
        
        try {
          results = await searchAPI.searchMeili(meiliParams);
        } catch (err: any) {
          // Graceful fallback: if Meilisearch semantic fails, try DB semantic endpoint
          if (meiliMode === 'semantic') {
            results = await searchAPI.semanticSearch({
              ...searchParameters,
              similarity_threshold: typeof filters.similarityThreshold === 'number' ? filters.similarityThreshold : 0.5,
            });
          } else {
            throw err;
          }
        }
      } else if (filters.searchType === 'semantic') {
        results = await searchAPI.semanticSearch({
          ...searchParameters,
          similarity_threshold: typeof filters.similarityThreshold === 'number' ? filters.similarityThreshold : 0.5,
        });
      } else {
        results = await searchAPI.search(searchParameters);
      }
      setSearchResults(results);

      // Update URL
      const newParams = new URLSearchParams();
      Object.entries(searchParameters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined) {
          newParams.set(key, value.toString());
        }
      });
      newParams.set('engine', searchEngine);
      if (searchEngine === 'meili') {
        newParams.set('mode', meiliMode);
        newParams.set('index', meiliIndex);
      }
      if (selectedLanguage !== 'auto') {
        newParams.set('language', selectedLanguage);
      }
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
      <div key={segment.id} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl hover:border-blue-300/50 transition-all duration-300 transform hover:-translate-y-1 dark:bg-gray-800/70 dark:border-gray-700 dark:hover:border-blue-400/30">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{segment.speaker_name}</span>
              </div>
              
              {segment.video && (
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>{segment.video.date}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{formatTimestamp(segment.video_seconds)}</span>
                {segment.timestamp_start && segment.timestamp_end && (
                  <span>({segment.timestamp_start}-{segment.timestamp_end})</span>
                )}
              </div>
            </div>

            {/* Video Info */}
            {segment.video && (
              <div className="text-sm text-gray-600 mb-2 dark:text-gray-300">
                <Link
                  to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                  className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {segment.video.title}
                </Link>
                {segment.video.source && (
                  <span className="ml-2 badge badge-blue">{segment.video.source}</span>
                )}
              </div>
            )}

            {/* Transcript Text */}
            <div className="text-gray-900 mb-4 leading-relaxed dark:text-gray-100">
              {selectionMode && (
                <label className="inline-flex items-center mr-3 align-top">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selectedSegmentIds.has(segment.id)}
                    onChange={() => toggleSelectSegment(segment.id)}
                  />
                </label>
              )}
              {highlightText(segment.transcript_text, query)}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3 dark:text-gray-400">
              <span>{segment.word_count} words</span>
              
              {typeof segment.similarity_score === 'number' && (
                <div className="flex items-center space-x-1">
                  <Search className="h-4 w-4" />
                  <span className="font-medium text-blue-600">
                    {(segment.similarity_score * 100).toFixed(1)}% match
                  </span>
                </div>
              )}
              
              {typeof segment.sentiment_loughran_score === 'number' && (
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className={sentimentColor}>{sentimentLabel}</span>
                </div>
              )}
              
              {typeof segment.flesch_kincaid_grade === 'number' && (
                <span>Grade: {segment.flesch_kincaid_grade.toFixed(1)}</span>
              )}
              
              {typeof segment.stresslens_score === 'number' && (
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>Stress: {segment.stresslens_score.toFixed(3)}</span>
                  {typeof segment.stresslens_rank === 'number' && (
                    <span className="text-gray-400">(#{segment.stresslens_rank})</span>
                  )}
                </div>
              )}

              {/* Match info chips */}
              {segment.segment_topics && segment.segment_topics.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Top topic: {segment.segment_topics[0].topic.name}
                </span>
              )}
              {typeof segment.moderation_overall_score === 'number' && segment.moderation_overall_score > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Mod: {(segment.moderation_overall_score * 100).toFixed(0)}%
                </span>
              )}
              {segment.video?.dataset && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {segment.video.dataset === 'tweede_kamer' ? 'Tweede Kamer' : segment.video.dataset}
                </span>
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
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* Right-side actions: expand and quick add */}
        <div className="flex items-center ml-4 space-x-1">
          {segment.video && (
            <button
              type="button"
              onClick={() => playlist.addSegment(segment as any)}
              className="p-2 text-primary-600 hover:text-primary-700"
              aria-label="Add segment to playlist"
              title="Add to Playlist"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleSegmentExpansion(segment.id)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4 dark:border-gray-700">
            {/* Detailed Sentiment Analysis */}
            {(typeof segment.sentiment_loughran_score === 'number' || 
              typeof segment.sentiment_harvard_score === 'number' || 
              typeof segment.sentiment_vader_score === 'number') && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">Sentiment Analysis</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {typeof segment.sentiment_loughran_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Loughran-McDonald:</span>
                      <span className={getSentimentColor(segment.sentiment_loughran_score)}>
                        {segment.sentiment_loughran_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {typeof segment.sentiment_harvard_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Harvard-IV:</span>
                      <span className={getSentimentColor(segment.sentiment_harvard_score)}>
                        {segment.sentiment_harvard_score.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {typeof segment.sentiment_vader_score === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">VADER:</span>
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
                <h4 className="text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">Readability Metrics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {typeof segment.flesch_kincaid_grade === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Flesch-Kincaid Grade:</span>
                      <span className="text-gray-900">{segment.flesch_kincaid_grade.toFixed(1)}</span>
                    </div>
                  )}
                  {typeof segment.flesch_reading_ease === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Reading Ease:</span>
                      <span className="text-gray-900">{segment.flesch_reading_ease.toFixed(1)}</span>
                    </div>
                  )}
                  {typeof segment.gunning_fog_index === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Gunning Fog:</span>
                      <span className="text-gray-900">{segment.gunning_fog_index.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Moderation */}
            {segment.moderation_overall_score !== undefined && segment.moderation_overall_score !== null && segment.moderation_overall_score > 0.1 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Content Moderation</h4>
                <div className="flex items-center space-x-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-gray-600">Overall Score:</span>
                  <span className="text-amber-600 font-medium">
                    {((segment.moderation_overall_score || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {segment.video && (
                <Link
                  to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play Clip
                </Link>
              )}
              {segment.video && (
                <Link
                  to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Context
                </Link>
              )}
              {segment.video && (
                <button
                  type="button"
                  onClick={() => playlist.addSegment(segment as any)}
                  className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                  title="Add segment to playlist"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add to Playlist
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
                className="block w-full pl-12 pr-44 py-4 border border-gray-300/50 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 dark:bg-gray-800/70 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Search transcripts, speakers, topics..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 space-x-2">
                <button
                  type="button"
                  onClick={() => setChatModalOpen(true)}
                  className="inline-flex items-center px-4 py-2.5 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  title="AI Chat Search"
                >
                  <Bot className="h-4 w-4 mr-1" />
                  Chat
                </button>
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
              <div className="flex items-center space-x-2">
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
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectionMode(!selectionMode)}
                      className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${selectionMode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'} hover:bg-gray-50 dark:hover:bg-gray-700`}
                    >
                      {selectionMode ? 'Exit Selection' : 'Select Segments'}
                    </button>
                    {selectionMode && (
                      <>
                        <button type="button" onClick={selectAllVisible} className="btn btn-outline">Select Page</button>
                        <button type="button" onClick={clearSelection} className="btn btn-outline">Clear</button>
                        <button type="button" onClick={exportSelectedTxt} className="btn btn-primary">Export Text</button>
                        <button type="button" onClick={exportSelectedWithLinks} className="btn btn-primary">Export + Links</button>
                      </>
                    )}
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={isExporting}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={isExporting}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      Export JSON
                    </button>
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
                  <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    {filters.searchType === 'semantic' ? '🧠 Semantic' : 
                     filters.searchType === 'fulltext' ? '🔍 Full-text' :
                     filters.searchType === 'exact' ? '🎯 Exact' : '🔄 Fuzzy'}
                  </span>
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

      {/* Chat Search Modal */}
      <ChatSearchModal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
      />
    </div>
  );
};

export default SearchPage;
