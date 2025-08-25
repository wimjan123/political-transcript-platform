import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, User, Tag, TrendingUp, AlertCircle, Clock,
  ExternalLink, Play, Plus, ChevronDown, ChevronRight
} from 'lucide-react';
import { playlist } from '../services/playlist';
import { formatTimestamp, getSentimentColor, getSentimentLabel, formatDate } from '../services/api';
import { EmotionSummary } from './EmotionIndicators';
import { SentimentSummary, SentimentTag } from './SentimentIndicators';
import type { TranscriptSegment } from '../types';

interface SearchSegmentCardProps {
  segment: TranscriptSegment;
  query: string;
  isExpanded: boolean;
  onToggleExpansion: (segmentId: number) => void;
  isSelected?: boolean;
  onToggleSelect?: (segmentId: number) => void;
  selectionMode?: boolean;
}

// Memoized highlight function to avoid recalculating on every render
const HighlightText = memo(({ text, searchQuery }: { text: string; searchQuery: string }) => {
  if (!searchQuery.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/40 px-1 rounded">{part}</mark>
        ) : part
      )}
    </>
  );
});

HighlightText.displayName = 'HighlightText';

const SearchSegmentCard = memo<SearchSegmentCardProps>(({ 
  segment, 
  query, 
  isExpanded, 
  onToggleExpansion,
  isSelected = false,
  onToggleSelect,
  selectionMode = false
}) => {
  const sentimentColor = getSentimentColor(segment.sentiment_loughran_score);
  const sentimentLabel = getSentimentLabel(segment.sentiment_loughran_score);

  const handleToggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpansion(segment.id);
  };

  const handleToggleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelect?.(segment.id);
  };

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    playlist.addSegment(segment as any);
  };

  const handleCardClick = () => {
    if (segment.video) {
      window.location.href = `/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`;
    }
  };

  return (
    <div 
      className="search-card bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-4 sm:p-6 hover:shadow-xl hover:border-blue-300/50 transition-all duration-300 transform hover:-translate-y-1 dark:bg-gray-800/70 dark:border-gray-700 dark:hover:border-blue-400/30 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 search-card-content min-w-0">
          {/* Header */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{segment.speaker_name}</span>
                {segment.speaker_party && segment.video?.dataset === 'tweede_kamer' && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                    {segment.speaker_party}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
              {segment.video && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{segment.video.date ? formatDate(segment.video.date) : 'No date'}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <div className="flex flex-wrap items-center gap-1">
                  <span>{formatTimestamp(segment.video_seconds)}</span>
                  {segment.timestamp_start && segment.timestamp_end && (
                    <span className="text-xs">({segment.timestamp_start}-{segment.timestamp_end})</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Video Info */}
          {segment.video && (
            <div className="text-sm text-gray-600 mb-2 dark:text-gray-300">
              <Link
                to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                className="font-medium text-primary-600 hover:text-primary-700 hover:underline block break-words"
                onClick={(e) => e.stopPropagation()}
              >
                {segment.video.title}
              </Link>
              {segment.video.source && (
                <span className="inline-block mt-1 badge badge-blue">{segment.video.source}</span>
              )}
            </div>
          )}

          {/* Transcript Text */}
          <div className="text-gray-800 mb-4 leading-relaxed dark:text-gray-200">
            {selectionMode && (
              <label className="inline-flex items-center mr-3 align-top">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={isSelected}
                  onChange={handleToggleSelect}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            )}
            <HighlightText text={segment.transcript_text} searchQuery={query} />
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-500 mb-3 dark:text-gray-400">
            <span className="truncate">{segment.word_count} words</span>
            
            {typeof segment.similarity_score === 'number' && (
              <div className="flex items-center space-x-1 truncate">
                <span className="font-medium text-blue-600">
                  {(segment.similarity_score * 100).toFixed(1)}% match
                </span>
              </div>
            )}
            
            {typeof segment.sentiment_loughran_score === 'number' && (
              <div className="flex items-center space-x-1 truncate">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span className={sentimentColor}>{sentimentLabel}</span>
              </div>
            )}
            
            {typeof segment.flesch_kincaid_grade === 'number' && (
              <span className="truncate">Grade: {segment.flesch_kincaid_grade.toFixed(1)}</span>
            )}
            
            {typeof segment.stresslens_score === 'number' && (
              <div className="flex items-center space-x-1 truncate">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Stress: {segment.stresslens_score.toFixed(3)}</span>
                {typeof segment.stresslens_rank === 'number' && (
                  <span className="text-gray-400">(#{segment.stresslens_rank})</span>
                )}
              </div>
            )}
          </div>

          {/* Match info chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {segment.segment_topics && segment.segment_topics.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 max-w-full truncate">
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
            <SentimentTag sentiment={segment.sentiment_label} />
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

        {/* Right-side actions */}
        <div className="flex items-start ml-2 sm:ml-4 space-x-1 flex-shrink-0">
          {segment.video && (
            <button
              type="button"
              onClick={handleAddToPlaylist}
              className="p-2 text-primary-600 hover:text-primary-700"
              aria-label="Add segment to playlist"
              title="Add to Playlist"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          {/* Expand/Collapse Button */}
          <button
            onClick={handleToggleExpansion}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4 dark:border-gray-700">
          {/* Detailed Sentiment Analysis */}
          {(typeof segment.sentiment_loughran_score === 'number' || 
            typeof segment.sentiment_harvard_score === 'number' || 
            typeof segment.sentiment_vader_score === 'number') && (
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2 dark:text-gray-200">Sentiment Analysis</h4>
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

          {/* 5-Class Sentiment Analysis */}
          <SentimentSummary 
            sentimentLabel={segment.sentiment_label}
            veryNegativeProb={segment.sentiment_vneg_prob}
            negativeProb={segment.sentiment_neg_prob}
            neutralProb={segment.sentiment_neu_prob}
            positiveProb={segment.sentiment_pos_prob}
            veryPositiveProb={segment.sentiment_vpos_prob}
          />

          {/* Readability Metrics */}
          {(typeof segment.flesch_kincaid_grade === 'number' || 
            typeof segment.flesch_reading_ease === 'number' ||
            typeof segment.gunning_fog_index === 'number') && (
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2 dark:text-gray-200">Readability Metrics</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                {typeof segment.flesch_kincaid_grade === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Flesch-Kincaid Grade:</span>
                    <span className="text-gray-800 dark:text-gray-200">{segment.flesch_kincaid_grade.toFixed(1)}</span>
                  </div>
                )}
                {typeof segment.flesch_reading_ease === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Reading Ease:</span>
                    <span className="text-gray-800 dark:text-gray-200">{segment.flesch_reading_ease.toFixed(1)}</span>
                  </div>
                )}
                {typeof segment.gunning_fog_index === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Gunning Fog:</span>
                    <span className="text-gray-800 dark:text-gray-200">{segment.gunning_fog_index.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content Moderation */}
          {segment.moderation_overall_score !== undefined && segment.moderation_overall_score !== null && segment.moderation_overall_score > 0.1 && (
            <div>
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Content Moderation</h4>
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {segment.video && (
              <Link
                to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Play className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="hidden sm:inline">Play Clip</span>
                <span className="sm:hidden">Play</span>
              </Link>
            )}
            {segment.video && (
              <Link
                to={`/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`}
                className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="hidden sm:inline">View Context</span>
                <span className="sm:hidden">Context</span>
              </Link>
            )}
            {segment.video && (
              <button
                type="button"
                onClick={handleAddToPlaylist}
                className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 transition-colors"
                title="Add segment to playlist"
              >
                <Plus className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="hidden sm:inline">Add to Playlist</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchSegmentCard.displayName = 'SearchSegmentCard';

export default SearchSegmentCard;