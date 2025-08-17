import React, { useState, useEffect } from 'react';
import { Bot, Loader2, AlertCircle, CheckCircle, FileText, Settings, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { summaryAPI } from '../services/api';
import { getModelById } from '../config/models';
import type { AISettings, SummaryResponse, AIProvider } from '../types';

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
  const [provider, setProvider] = useState<AIProvider>(
    defaultSettings?.provider || 'openai'
  );
  const [apiKey, setApiKey] = useState<string>(
    defaultSettings?.apiKey || ''
  );
  const [model, setModel] = useState<string>(
    defaultSettings?.model || 'gpt-4o-mini'
  );
  const [customModel, setCustomModel] = useState<string>(
    defaultSettings?.customModel || ''
  );
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
          setProvider(parsed.provider || 'openai');
          setApiKey(parsed.apiKey || '');
          setModel(parsed.model || 'gpt-4o-mini');
          setCustomModel(parsed.customModel || '');
          setSummaryLength(parsed.defaultSummaryLength || 'medium');
          setSummaryFormat(parsed.defaultSummaryFormat || 'bullet_points');
          setCustomPrompt(parsed.defaultCustomPrompt || customPrompt);
        } catch (error) {
          console.error('Failed to parse saved AI settings:', error);
        }
      }
    }
  }, [defaultSettings]);

  // Check if video can be summarized and load cached summary
  useEffect(() => {
    if (videoId) {
      checkCanSummarize();
      loadCachedSummary();
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

  const loadCachedSummary = async () => {
    try {
      const cachedSummary = await summaryAPI.getCachedSummary(videoId);
      if (cachedSummary) {
        setSummary(cachedSummary);
      }
    } catch (error) {
      // No cached summary exists or error loading it - this is normal
      console.log('No cached summary found for video', videoId);
    }
  };

  const deleteCachedSummary = async () => {
    try {
      await summaryAPI.deleteCachedSummary(videoId);
      setSummary(null);
    } catch (error) {
      console.error('Failed to delete cached summary:', error);
      setError('Failed to clear cached summary');
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

    // Validate required settings
    if (!apiKey.trim()) {
      setError('Please configure your API key in AI Settings first.');
      return;
    }

    // Validate custom model if selected
    if (model === 'custom' && !customModel.trim()) {
      setError('Please enter a custom model ID or select a predefined model.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const bulletPoints = getBulletPointsCount(summaryLength);
      // Use custom model if selected, otherwise use the selected model
      const effectiveModel = model === 'custom' ? customModel : model;
      
      // Debug logging
      console.log('Generating summary with params:', {
        videoId,
        bulletPoints,
        customPrompt,
        provider,
        model: effectiveModel,
        hasApiKey: !!apiKey
      });
      
      const result = await summaryAPI.generateSummary(
        videoId, 
        bulletPoints, 
        customPrompt,
        provider,
        effectiveModel,
        apiKey
      );
      
      console.log('Summary result:', result);
      setSummary(result);
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      console.error('Error details:', error.response?.data);
      setError(error.response?.data?.detail || error.message || 'Failed to generate summary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedModel = getModelById(model);
  const effectiveModel = model === 'custom' ? customModel : model;
  const effectiveModelName = model === 'custom' ? (customModel || 'Custom Model') : (selectedModel?.name || model);
  const hasValidConfig = apiKey.trim().length > 0 && (model !== 'custom' || customModel.trim().length > 0);

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
      {/* Video Info & Model Info */}
      {!compact && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span className="font-medium">{videoTitle}</span>
            <span>•</span>
            <span>{segmentCount} segments</span>
          </div>
          
          {/* Model Configuration Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-gray-600">Using:</span>
              <span className="font-medium text-gray-900" title={effectiveModel}>
                {effectiveModelName}
              </span>
              <span className="text-gray-500">via {provider === 'openai' ? 'OpenAI' : 'OpenRouter'}</span>
            </div>
            <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
              hasValidConfig 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                hasValidConfig ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>{hasValidConfig ? 'Configured' : 'Missing API Key'}</span>
            </div>
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
        disabled={isLoading || !hasValidConfig}
        className={`w-full btn flex items-center justify-center ${
          hasValidConfig ? 'btn-primary' : 'btn-outline opacity-50 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Summary...
          </>
        ) : (
          <>
            <Bot className="h-4 w-4 mr-2" />
            {hasValidConfig ? 'Generate Summary' : 'Configure API Key First'}
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
        <div className={`rounded-lg p-6 ${
          summary.metadata?.cached 
            ? 'bg-blue-50 border border-blue-200' 
            : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {summary.metadata?.cached ? (
                <Clock className="h-5 w-5 text-blue-600 mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              )}
              <h3 className={`text-lg font-medium ${
                summary.metadata?.cached ? 'text-blue-900' : 'text-green-900'
              }`}>
                {summary.metadata?.cached ? 'Cached Summary' : 'Summary Generated'}
              </h3>
            </div>
            
            {summary.metadata?.cached && (
              <button
                onClick={deleteCachedSummary}
                className="inline-flex items-center px-3 py-1 text-xs text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
                title="Clear cached summary and generate a new one"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </button>
            )}
          </div>
          
          <div className="prose prose-sm max-w-none">
            <div className={`bg-white rounded-lg p-4 border ${
              summary.metadata?.cached ? 'border-blue-200' : 'border-green-200'
            }`}>
              <h4 className="text-sm font-medium text-gray-900 mb-3">{summary.video_title}</h4>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {summary.summary}
              </div>
            </div>
          </div>

          {/* Summary Metadata */}
          <div className={`mt-4 text-xs space-y-1 ${
            summary.metadata?.cached ? 'text-blue-700' : 'text-green-700'
          }`}>
            <div className="flex items-center justify-between">
              <span>Bullet Points: {summary.bullet_points}</span>
              <span>Provider: {summary.metadata?.provider_used || provider === 'openai' ? 'OpenAI' : 'OpenRouter'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Model: {summary.metadata?.model_used || effectiveModelName}</span>
              {summary.metadata?.tokens_used && (
                <span>Tokens: {summary.metadata.tokens_used}</span>
              )}
            </div>
            {summary.metadata?.cached && summary.metadata?.generated_at && (
              <div className="flex items-center justify-between">
                <span>Generated: {new Date(summary.metadata.generated_at).toLocaleString()}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                  Cached
                </span>
              </div>
            )}
            {!summary.metadata?.cached && model === 'custom' && (
              <div className={`text-xs ${
                summary.metadata?.cached ? 'text-blue-600' : 'text-green-600'
              }`}>
                Model ID: {effectiveModel}
              </div>
            )}
            {summary.metadata?.generation_time && (
              <div>Generation Time: {summary.metadata.generation_time}s</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptSummarizer;