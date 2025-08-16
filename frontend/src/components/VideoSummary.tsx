import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Settings2,
  Loader2,
  Clock,
  BarChart3
} from 'lucide-react';

interface VideoSummaryProps {
  videoId: number;
  videoTitle: string;
}

interface SummaryData {
  video_id: number;
  video_title: string;
  summary: string;
  bullet_points: number;
  metadata: {
    total_segments: number;
    total_words: number;
    total_characters: number;
    duration_seconds?: number;
    summarization_method: string;
    model_used: string;
    generated_at: string;
  };
}

interface SummaryCapability {
  video_id: number;
  video_title: string;
  can_summarize: boolean;
  segment_count: number;
  summarization_available: boolean;
}

const VideoSummary: React.FC<VideoSummaryProps> = ({ videoId, videoTitle }) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [capability, setCapability] = useState<SummaryCapability | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulletPoints, setBulletPoints] = useState(4);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    checkSummaryCapability();
  }, [videoId]);

  const checkSummaryCapability = async () => {
    try {
      const response = await fetch(`/api/summarization/video/${videoId}/can-summarize`);
      if (response.ok) {
        const data = await response.json();
        setCapability(data);
      }
    } catch (err) {
      console.error('Failed to check summary capability:', err);
    }
  };

  const generateSummary = async () => {
    if (!capability?.can_summarize) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/summarization/video/${videoId}/summary?bullet_points=${bulletPoints}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummaryData(data);
      setIsExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  if (!capability) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking summary availability...</span>
        </div>
      </div>
    );
  }

  if (!capability.can_summarize) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Summary Not Available</h3>
            <p className="text-sm text-amber-700 mt-1">
              This video has no transcript segments available for summarization.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">AI Summary</h3>
              <p className="text-sm text-gray-600">
                {capability.segment_count} transcript segments available
              </p>
            </div>
          </div>

          {!summaryData && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Settings2 className="h-4 w-4 text-gray-500" />
                <select
                  value={bulletPoints}
                  onChange={(e) => setBulletPoints(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  disabled={isLoading}
                >
                  <option value={3}>3 points</option>
                  <option value={4}>4 points</option>
                  <option value={5}>5 points</option>
                </select>
              </div>
              <button
                onClick={generateSummary}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-6 border-b border-gray-200">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Error Generating Summary</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={generateSummary}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Content */}
      {summaryData && (
        <div className="p-6">
          {/* Summary Text */}
          <div className="mb-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-line text-gray-900 text-base leading-relaxed">
                {summaryData.summary}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-gray-700">Summary Details</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500">
                  {isExpanded ? 'Hide' : 'Show'} details
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600">Segments</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {summaryData.metadata.total_segments.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-gray-600">Words</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {summaryData.metadata.total_words.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-medium text-gray-600">Duration</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {formatDuration(summaryData.metadata.duration_seconds)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Settings2 className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-medium text-gray-600">Model</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {summaryData.metadata.model_used}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>Generated {formatDate(summaryData.metadata.generated_at)}</span>
              <button
                onClick={generateSummary}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoSummary;