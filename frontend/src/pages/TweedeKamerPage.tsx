import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Download, Users, Calendar, Shield, AlertCircle } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useSmartSearch } from '../hooks/useSearch';
import { SearchParams } from '../types';
import VirtualizedSearchResults from '../components/VirtualizedSearchResults';
import { DUTCH_POLITICAL_PARTIES, DUTCH_SPEAKER_ROLES, detectSpeakerRole, getPartyByCode } from '../constants/dutch-politics';

interface TweedeKamerFilters {
  speaker: string;
  party: string;
  role: string;
  dateFrom: string;
  dateTo: string;
  searchType: 'fulltext' | 'semantic' | 'exact' | 'fuzzy';
  sortBy: 'relevance' | 'date' | 'speaker';
  sortOrder: 'asc' | 'desc';
}

const TweedeKamerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '25'));
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<number>>(new Set());

  // Tweede Kamer specific filters
  const [filters, setFilters] = useState<TweedeKamerFilters>({
    speaker: searchParams.get('speaker') || '',
    party: searchParams.get('party') || '',
    role: searchParams.get('role') || '',
    dateFrom: searchParams.get('date_from') || '',
    dateTo: searchParams.get('date_to') || '',
    searchType: (searchParams.get('search_type') as any) || 'fulltext',
    sortBy: (searchParams.get('sort_by') as any) || 'relevance',
    sortOrder: (searchParams.get('sort_order') as any) || 'desc',
  });

  const debouncedQuery = useDebounce(query, 200);

  // Build search parameters with Tweede Kamer dataset filter
  const searchParameters = useMemo<SearchParams>(() => {
    const mappedFilters: Record<string, any> = {};
    const add = (k: string, v: any) => { if (v !== '' && v !== undefined) mappedFilters[k] = v; };
    
    // Always filter to Tweede Kamer dataset
    add('dataset', 'tweede_kamer');
    add('speaker', filters.speaker);
    add('date_from', filters.dateFrom);
    add('date_to', filters.dateTo);

    return {
      q: debouncedQuery,
      page: currentPage,
      page_size: pageSize,
      search_type: filters.searchType,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
      ...mappedFilters,
    };
  }, [debouncedQuery, currentPage, pageSize, filters]);

  // Use smart search with TanStack Query
  const {
    data: searchResults,
    isLoading,
    error,
  } = useSmartSearch(searchParameters, !!debouncedQuery.trim());

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

  const handleFilterChange = useCallback((key: keyof TweedeKamerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      speaker: '',
      party: '',
      role: '',
      dateFrom: '',
      dateTo: '',
      searchType: 'fulltext',
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
    setCurrentPage(1);
  }, []);

  const toggleSelectSegment = useCallback((id: number) => {
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedSegments = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.results.filter(s => selectedSegmentIds.has(s.id));
  }, [searchResults, selectedSegmentIds]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Tweede Kamer Debatten
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Doorzoek Nederlandse parlementaire debatten en speeches uit de Tweede Kamer met geavanceerde zoekfunctionaliteit
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-8 dark:bg-gray-900/90 dark:border-gray-800">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Zoek in Tweede Kamer debatten..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-6 py-3 rounded-xl border transition-colors ${
                  showFilters
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="h-5 w-5" />
              </button>
            </div>

            {/* Dutch Political Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                
                {/* Speaker Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Spreker
                  </label>
                  <input
                    type="text"
                    value={filters.speaker}
                    onChange={(e) => handleFilterChange('speaker', e.target.value)}
                    placeholder="Naam van spreker"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>

                {/* Political Party Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Politieke Partij
                  </label>
                  <select
                    value={filters.party}
                    onChange={(e) => handleFilterChange('party', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  >
                    <option value="">Alle partijen</option>
                    {DUTCH_POLITICAL_PARTIES.map(party => (
                      <option key={party.code} value={party.code}>
                        {party.code} - {party.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker Role Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Functie
                  </label>
                  <select
                    value={filters.role}
                    onChange={(e) => handleFilterChange('role', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  >
                    <option value="">Alle functies</option>
                    {DUTCH_SPEAKER_ROLES.map(role => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Datum
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      className="flex-1 px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      className="flex-1 px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    Filters wissen
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Zoeken...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/20 dark:border-red-800">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <span className="text-red-700 dark:text-red-300">{error.message}</span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Zoekresultaten
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchResults.total.toLocaleString()} resultaten voor "{searchResults.query}"
                  <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                    🏛️ Tweede Kamer
                  </span>
                  {searchResults.total > 0 && (
                    <span>
                      {' '}• Toont {((searchResults.page - 1) * searchResults.page_size) + 1}-
                      {Math.min(searchResults.page * searchResults.page_size, searchResults.total)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Results Display */}
            {searchResults.results.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-white">Geen resultaten gevonden</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Probeer andere zoektermen of pas uw filters aan.
                </p>
              </div>
            ) : (
              <VirtualizedSearchResults
                results={searchResults.results}
                query={query}
                onToggleSelect={toggleSelectSegment}
                selectedSegmentIds={selectedSegmentIds}
                selectionMode={selectedSegmentIds.size > 0}
                expandedSegments={new Set()}
                onToggleExpansion={() => {}}
              />
            )}

            {/* Pagination */}
            {searchResults.total > pageSize && (
              <div className="mt-8 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Pagina {searchResults.page} van {Math.ceil(searchResults.total / pageSize)}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Vorige
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(searchResults.total / pageSize)}
                    className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TweedeKamerPage;