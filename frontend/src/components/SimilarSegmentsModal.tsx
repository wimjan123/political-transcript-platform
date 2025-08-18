import React, { useState, useEffect } from 'react';
import { X, Clock, User, TrendingUp, ExternalLink } from 'lucide-react';
import { searchAPI, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import type { SearchResponse, TranscriptSegment } from '../types';

interface SimilarSegmentsModalProps {
  segmentId: number;
  segmentText: string;
  isOpen: boolean;
  onClose: () => void;
}

const SimilarSegmentsModal: React.FC<SimilarSegmentsModalProps> = ({
  segmentId,
  segmentText,
  isOpen,
  onClose,
}) => {
  const [similarSegments, setSimilarSegments] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && segmentId) {
      loadSimilarSegments();
    }
  }, [isOpen, segmentId]);

  const loadSimilarSegments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response: SearchResponse = await searchAPI.findSimilarSegments(segmentId, 8);
      setSimilarSegments(response.results);
    } catch (err: any) {
      console.error('Failed to load similar segments:', err);
      setError('Failed to load similar segments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    if (segment.video) {
      const url = `/videos/${segment.video.id}?t=${segment.video_seconds}&segment_id=${segment.id}`;
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Similar Segments</h3>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                Segments similar to: "{segmentText.substring(0, 100)}..."
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Finding similar segments...</span>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900/30 dark:border-red-800">
                <p className="text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={loadSimilarSegments}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline dark:text-red-300 dark:hover:text-red-200"
                >
                  Try again
                </button>
              </div>
            )}
            
            {!isLoading && !error && similarSegments.length === 0 && (
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No similar segments found</h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Try searching with different keywords or check back later.
                </p>
              </div>
            )}
            
            {similarSegments.length > 0 && (
              <div className="space-y-4">
                {similarSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer dark:border-gray-700 dark:hover:border-blue-400/40"
                    onClick={() => handleSegmentClick(segment)}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{segment.speaker_name}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimestamp(segment.video_seconds)}</span>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                    
                    {/* Video Info */}
                    {segment.video && (
                      <div className="text-sm text-gray-600 mb-2 dark:text-gray-300">
                        <span className="font-medium">{segment.video.title}</span>
                        {segment.video.date && (
                          <span className="ml-2 text-gray-400">• {segment.video.date}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Transcript Text */}
                    <div className="text-gray-900 mb-3 leading-relaxed dark:text-gray-100">
                      {segment.transcript_text}
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{segment.word_count} words</span>
                      
                      {typeof segment.similarity_score === 'number' && (
                        <span className="font-medium text-blue-600">
                          {(segment.similarity_score * 100).toFixed(1)}% similar
                        </span>
                      )}
                      
                      {typeof segment.sentiment_loughran_score === 'number' && (
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className={getSentimentColor(segment.sentiment_loughran_score)}>
                            {getSentimentLabel(segment.sentiment_loughran_score)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimilarSegmentsModal;
