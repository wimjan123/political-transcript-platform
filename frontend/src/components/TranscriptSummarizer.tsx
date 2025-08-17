import React, { useState, useEffect } from 'react';
import { Bot, Loader2, AlertCircle, CheckCircle, FileText, Settings } from 'lucide-react';
import { summaryAPI } from '../services/api';
import type { AISettings, SummaryResponse } from '../types';

interface TranscriptSummarizerProps {
  videoId: number;
  defaultSettings?: Partial<AISettings>;
  compact?: boolean;
}

const TranscriptSummarizer: React.FC<TranscriptSummarizerProps> = ({
  videoId,
  defaultSettings,
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [canSummarize, setCanSummarize] = useState<boolean | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [segmentCount, setSegmentCount] = useState<number>(0);
  
  // Local settings that can override defaults
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>(
    defaultSettings?.defaultSummaryLength || 'medium'
  );
  const [summaryFormat, setSummaryFormat] = useState<'bullet_points' | 'paragraph'>(
    defaultSettings?.defaultSummaryFormat || 'bullet_points'
  );
  const [customPrompt, setCustomPrompt] = useState<string>(
    defaultSettings?.defaultCustomPrompt || 'Provide a clear, objective summary of the key points discussed in this political transcript.'
  );
  const [showCustomization, setShowCustomization] = useState(false);

  // Load settings from localStorage if no defaults provided
  useEffect(() => {
    if (!defaultSettings) {
      const savedSettings = localStorage.getItem('aiSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSummaryLength(parsed.defaultSummaryLength || 'medium');
          setSummaryFormat(parsed.defaultSummaryFormat || 'bullet_points');
          setCustomPrompt(parsed.defaultCustomPrompt || customPrompt);
        } catch (error) {
          console.error('Failed to parse saved AI settings:', error);
        }
      }
    }
  }, [defaultSettings]);

  // Check if video can be summarized
  useEffect(() => {
    if (videoId) {
      checkCanSummarize();
    }
  }, [videoId]);

  const checkCanSummarize = async () => {
    try {
      const result = await summaryAPI.canSummarize(videoId);
      setCanSummarize(result.can_summarize);
      setVideoTitle(result.video_title);
      setSegmentCount(result.segment_count);
    } catch (error) {
      console.error('Failed to check summarization capability:', error);
      setCanSummarize(false);
    }
  };

  const getBulletPointsCount = (length: string): number => {
    switch (length) {
      case 'short': return 3;
      case 'medium': return 4;
      case 'long': return 5;
      default: return 4;
    }
  };

  const generateSummary = async () => {
    if (!canSummarize) return;

    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const bulletPoints = getBulletPointsCount(summaryLength);
      const result = await summaryAPI.generateSummary(videoId, bulletPoints, customPrompt);
      setSummary(result);
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      setError(error.response?.data?.detail || 'Failed to generate summary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (canSummarize === null) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Checking video...</span>
      </div>
    );
  }

  if (!canSummarize) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-800">
            This video cannot be summarized. It has {segmentCount} transcript segments.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Info */}
      {!compact && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span className="font-medium">{videoTitle}</span>
            <span>•</span>
            <span>{segmentCount} segments</span>
          </div>
        </div>
      )}

      {/* Customization Options */}
      {!compact && (
        <div className="space-y-4">
          <button
            onClick={() => setShowCustomization(!showCustomization)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Settings className="h-4 w-4 mr-2" />
            {showCustomization ? 'Hide' : 'Show'} Customization Options
          </button>

          {showCustomization && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              {/* Summary Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary Length
                </label>
                <div className="space-y-1">
                  {(['short', 'medium', 'long'] as const).map((length) => (
                    <label key={length} className="flex items-center">
                      <input
                        type="radio"
                        name="summaryLength"
                        value={length}
                        checked={summaryLength === length}
                        onChange={(e) => setSummaryLength(e.target.value as any)}
                        className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">
                        {length} ({getBulletPointsCount(length)} points)
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary Format
                </label>
                <div className="space-y-1">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="summaryFormat"
                      value="bullet_points"
                      checked={summaryFormat === 'bullet_points'}
                      onChange={(e) => setSummaryFormat(e.target.value as any)}
                      className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Bullet Points</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="summaryFormat"
                      value="paragraph"
                      checked={summaryFormat === 'paragraph'}
                      onChange={(e) => setSummaryFormat(e.target.value as any)}
                      className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Paragraph</span>
                  </label>
                </div>
              </div>

              {/* Custom Prompt */}
              <div>
                <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Instructions
                </label>
                <textarea
                  id="customPrompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  placeholder="Enter custom instructions for the AI summarization..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateSummary}
        disabled={isLoading}
        className="w-full btn btn-primary flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Summary...
          </>
        ) : (
          <>
            <Bot className="h-4 w-4 mr-2" />
            Generate Summary
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Display */}
      {summary && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-medium text-green-900">Summary Generated</h3>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">{summary.video_title}</h4>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {summary.summary}
              </div>
            </div>
          </div>

          {/* Summary Metadata */}
          <div className="mt-4 text-xs text-green-700 space-y-1">
            <div>Bullet Points: {summary.bullet_points}</div>
            {summary.metadata && Object.keys(summary.metadata).length > 0 && (
              <div>
                Model: {summary.metadata.model || 'Unknown'}
                {summary.metadata.tokens_used && ` • Tokens: ${summary.metadata.tokens_used}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptSummarizer;