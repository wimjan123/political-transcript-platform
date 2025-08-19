import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchAPI } from '../services/api';
import type { SearchParams, SearchResponse } from '../types';

/**
 * Hook for standard search functionality with TanStack Query
 * Provides caching, background refetching, and optimistic updates
 */
export const useSearch = (params: SearchParams, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['search', params],
    queryFn: () => searchAPI.search(params),
    enabled: enabled && !!params.q?.trim(),
    placeholderData: keepPreviousData, // Keep previous results while loading new ones
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 1, // Only retry once on failure for better UX
  });
};

/**
 * Hook for semantic search with similarity threshold
 */
export const useSemanticSearch = (
  params: SearchParams & { similarity_threshold?: number }, 
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['search', 'semantic', params],
    queryFn: () => searchAPI.semanticSearch(params),
    enabled: enabled && !!params.q?.trim(),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000, // Semantic search results stay fresh longer
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Hook for Meilisearch with different modes (lexical, hybrid, semantic)
 */
export const useMeilisearch = (
  params: {
    q: string;
    page?: number;
    page_size?: number;
    mode?: 'lexical' | 'hybrid' | 'semantic';
    index?: 'segments' | 'events';
    locales?: string[];
  } & Record<string, any>,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['search', 'meili', params],
    queryFn: () => searchAPI.searchMeili(params),
    enabled: enabled && !!params.q?.trim(),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Hook for search suggestions with aggressive caching
 */
export const useSearchSuggestions = (
  query: string,
  type: string = 'all',
  limit: number = 10,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['search', 'suggestions', query, type, limit],
    queryFn: () => searchAPI.getSuggestions(query, type, limit),
    enabled: enabled && query.length >= 2, // Only fetch for 2+ characters
    staleTime: 5 * 60 * 1000, // Suggestions stay fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep suggestions in cache for 30 minutes
    retry: false, // Don't retry failed suggestion requests
  });
};

/**
 * Hook for finding similar segments
 */
export const useSimilarSegments = (
  segmentId: number,
  limit: number = 10,
  index: 'segments' | 'events' = 'segments',
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['search', 'similar', segmentId, limit, index],
    queryFn: () => searchAPI.findSimilarSegments(segmentId, limit, index),
    enabled: enabled && segmentId > 0,
    staleTime: 10 * 60 * 1000, // Similar segments stay fresh for 10 minutes
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Custom hook that automatically selects the appropriate search method
 * based on search parameters and provides unified interface
 */
export const useSmartSearch = (
  params: SearchParams & {
    engine?: 'postgres' | 'meili';
    mode?: 'lexical' | 'hybrid' | 'semantic';
    index?: 'segments' | 'events';
    similarity_threshold?: number;
    locales?: string[];
  },
  enabled: boolean = true
) => {
  const { engine = 'postgres', mode = 'lexical', ...searchParams } = params;

  // Use different hooks based on engine and search type
  const postgresQuery = useSearch(searchParams, enabled && engine === 'postgres' && params.search_type !== 'semantic');
  const semanticQuery = useSemanticSearch(
    { ...searchParams, similarity_threshold: params.similarity_threshold }, 
    enabled && engine === 'postgres' && params.search_type === 'semantic'
  );
  const meiliQuery = useMeilisearch(
    { ...searchParams, mode, index: params.index, locales: params.locales },
    enabled && engine === 'meili'
  );

  // Return the active query based on current settings
  if (engine === 'meili') {
    return meiliQuery;
  } else if (params.search_type === 'semantic') {
    return semanticQuery;
  } else {
    return postgresQuery;
  }
};

export default useSearch;