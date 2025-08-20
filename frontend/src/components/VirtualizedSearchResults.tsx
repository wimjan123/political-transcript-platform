import React, { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import SearchSegmentCard from './SearchSegmentCard';
import type { TranscriptSegment } from '../types';

interface VirtualizedSearchResultsProps {
  results: TranscriptSegment[];
  query: string;
  expandedSegments: Set<number>;
  onToggleExpansion: (segmentId: number) => void;
  selectedSegmentIds: Set<number>;
  onToggleSelect: (segmentId: number) => void;
  selectionMode: boolean;
  containerHeight?: number;
}

interface ItemData {
  results: TranscriptSegment[];
  query: string;
  expandedSegments: Set<number>;
  onToggleExpansion: (segmentId: number) => void;
  selectedSegmentIds: Set<number>;
  onToggleSelect: (segmentId: number) => void;
  selectionMode: boolean;
}

// Individual row component for react-window
const Row = memo<{ 
  index: number; 
  style: React.CSSProperties; 
  data: ItemData 
}>(({ index, style, data }) => {
  const segment = data.results[index];
  
  // Calculate estimated height based on expansion state
  const isExpanded = data.expandedSegments.has(segment.id);
  const baseHeight = 280; // Base card height
  const expandedHeight = 400; // Estimated expanded height
  
  return (
    <div style={style}>
      <div className="px-0 pb-6"> {/* Increased padding between cards */}
        <SearchSegmentCard
          segment={segment}
          query={data.query}
          isExpanded={isExpanded}
          onToggleExpansion={data.onToggleExpansion}
          isSelected={data.selectedSegmentIds.has(segment.id)}
          onToggleSelect={data.onToggleSelect}
          selectionMode={data.selectionMode}
        />
      </div>
    </div>
  );
});

Row.displayName = 'VirtualizedSearchResultRow';

const VirtualizedSearchResults = memo<VirtualizedSearchResultsProps>(({ 
  results, 
  query, 
  expandedSegments, 
  onToggleExpansion, 
  selectedSegmentIds, 
  onToggleSelect, 
  selectionMode,
  containerHeight = 600 
}) => {
  // Memoize the data object to prevent unnecessary re-renders
  const itemData: ItemData = useMemo(() => ({
    results,
    query,
    expandedSegments,
    onToggleExpansion,
    selectedSegmentIds,
    onToggleSelect,
    selectionMode,
  }), [results, query, expandedSegments, onToggleExpansion, selectedSegmentIds, onToggleSelect, selectionMode]);

  // Calculate dynamic item size based on expansion state
  const getItemSize = (index: number): number => {
    const segment = results[index];
    const isExpanded = expandedSegments.has(segment.id);
    
    // Increased base height for mobile compatibility + extra for expanded content + padding
    const baseHeight = 350; // Increased from 280 to 350
    const expandedAddition = 300; // Increased from 200 to 300 for expanded details
    const padding = 24; // Increased padding between cards
    
    return baseHeight + (isExpanded ? expandedAddition : 0) + padding;
  };

  // If we have no results, render empty state
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400">No search results found</div>
      </div>
    );
  }

  // For small result sets (< 20) or mobile, use regular rendering for better UX
  // Check for mobile width (assuming typical mobile breakpoint)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  if (results.length < 20 || isMobile) {
    return (
      <div className="search-results-container space-y-4">
        {results.map(segment => (
          <SearchSegmentCard
            key={segment.id}
            segment={segment}
            query={query}
            isExpanded={expandedSegments.has(segment.id)}
            onToggleExpansion={onToggleExpansion}
            isSelected={selectedSegmentIds.has(segment.id)}
            onToggleSelect={onToggleSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    );
  }

  // For larger result sets, use virtualization
  return (
    <div className="search-results-container virtualized-search-results">
      <List
        height={containerHeight}
        width="100%"
        itemCount={results.length}
        itemData={itemData}
        itemSize={374} // Increased from 280 to 374 (350 base + 24 padding)
        overscanCount={2} // Render 2 extra items outside the visible area
        className="custom-scrollbar"
      >
        {Row}
      </List>
    </div>
  );
});

VirtualizedSearchResults.displayName = 'VirtualizedSearchResults';

export default VirtualizedSearchResults;