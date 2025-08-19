import React, { useState, useEffect } from 'react';
import { 
  Bot, Loader2, AlertCircle, CheckCircle, FileText, Sparkles, 
  RefreshCw, Clock, Save, Trash2, Plus, MessageSquare, Send, X, 
  Download, Copy, RotateCcw, Sliders
} from 'lucide-react';
import { summaryAPI } from '../services/api';
import { getModelById } from '../config/models';
import type { AISettings, SummaryResponse, AIPreset } from '../types';

interface EnhancedTranscriptSummarizerProps {
  videoId: number;
  defaultSettings?: Partial<AISettings>;
  compact?: boolean;
}

// Built-in presets
const BUILTIN_PRESETS: AIPreset[] = [
  {
    id: 'quick',
    name: 'Quick Summary',
    description: 'Fast, basic summary with key points',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      defaultSummaryLength: 'short',
      defaultSummaryFormat: 'bullet_points',
      temperature: 0.3,
      detailLevel: 'low',
      tone: 'neutral',
      perspective: 'objective'
    }
  },
  {
    id: 'detailed',
    name: 'Detailed Analysis',
    description: 'Comprehensive analysis with high detail',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      defaultSummaryLength: 'long',
      defaultSummaryFormat: 'bullet_points',
      temperature: 0.7,
      detailLevel: 'high',
      tone: 'analytical',
      perspective: 'balanced',
      includeTimestamps: true,
      includeSpeakers: true
    }
  },
  {
    id: 'journalistic',
    name: 'News Summary',
    description: 'Journalistic style summary for news content',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      defaultSummaryLength: 'medium',
      defaultSummaryFormat: 'paragraph',
      temperature: 0.5,
      tone: 'journalistic',
      perspective: 'objective',
      detailLevel: 'medium'
    }
  },
  {
    id: 'academic',
    name: 'Academic Analysis',
    description: 'Formal academic style with critical perspective',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      defaultSummaryLength: 'long',
      defaultSummaryFormat: 'paragraph',
      temperature: 0.2,
      tone: 'formal',
      perspective: 'critical',
      detailLevel: 'high',
      includeTimestamps: true
    }
  }
];

const EnhancedTranscriptSummarizer: React.FC<EnhancedTranscriptSummarizerProps> = ({
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
  
  // Enhanced settings state
  const [settings, setSettings] = useState<AISettings>({
    provider: defaultSettings?.provider || 'openai',
    apiKey: defaultSettings?.apiKey || '',
    model: defaultSettings?.model || 'gpt-4o-mini',
    customModel: defaultSettings?.customModel || '',
    defaultSummaryLength: defaultSettings?.defaultSummaryLength || 'medium',
    defaultSummaryFormat: defaultSettings?.defaultSummaryFormat || 'bullet_points',
    defaultCustomPrompt: defaultSettings?.defaultCustomPrompt || 'Provide a clear, objective summary of the key points discussed in this political transcript.',
    // Enhanced options with defaults
    temperature: defaultSettings?.temperature ?? 0.7,
    maxTokens: defaultSettings?.maxTokens ?? 1000,
    topP: defaultSettings?.topP ?? 1.0,
    frequencyPenalty: defaultSettings?.frequencyPenalty ?? 0.0,
    presencePenalty: defaultSettings?.presencePenalty ?? 0.0,
    customBulletPoints: defaultSettings?.customBulletPoints,
    includeTimestamps: defaultSettings?.includeTimestamps ?? false,
    includeSpeakers: defaultSettings?.includeSpeakers ?? false,
    focusAreas: defaultSettings?.focusAreas || [],
    excludeAreas: defaultSettings?.excludeAreas || [],
    tone: defaultSettings?.tone || 'neutral',
    perspective: defaultSettings?.perspective || 'objective',
    detailLevel: defaultSettings?.detailLevel || 'medium',
    language: defaultSettings?.language || 'English'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: any;
    isError?: boolean;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    if (!defaultSettings) {
      const savedSettings = localStorage.getItem('aiSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Failed to parse saved AI settings:', error);
        }
      }
    }
    
    loadPresets();
  }, [defaultSettings]);

  // Load presets from localStorage
  const loadPresets = () => {
    const savedPresets = localStorage.getItem('aiPresets');
    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets);
        setPresets([...BUILTIN_PRESETS, ...parsed]);
      } catch (error) {
        console.error('Failed to parse saved presets:', error);
        setPresets(BUILTIN_PRESETS);
      }
    } else {
      setPresets(BUILTIN_PRESETS);
    }
  };

  // Check if video can be summarized
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
      console.log('No cached summary found for video', videoId);
    }
  };

  const updateSetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getBulletPointsCount = (): number => {
    if (settings.customBulletPoints && settings.customBulletPoints > 0) {
      return settings.customBulletPoints;
    }
    switch (settings.defaultSummaryLength) {
      case 'short': return 3;
      case 'medium': return 4;
      case 'long': return 5;
      default: return 4;
    }
  };

  const buildCustomPrompt = (): string => {
    let prompt = settings.defaultCustomPrompt;
    
    // Add tone instruction
    if (settings.tone && settings.tone !== 'neutral') {
      prompt += ` Use a ${settings.tone} tone.`;
    }
    
    // Add perspective instruction
    if (settings.perspective && settings.perspective !== 'objective') {
      prompt += ` Provide a ${settings.perspective} perspective.`;
    }
    
    // Add detail level instruction
    if (settings.detailLevel) {
      const detailMap = {
        'high': 'Include comprehensive details and context.',
        'medium': 'Include moderate detail with key context.',
        'low': 'Focus on key points with minimal detail.'
      };
      prompt += ` ${detailMap[settings.detailLevel]}`;
    }
    
    // Add timestamp instruction
    if (settings.includeTimestamps) {
      prompt += ' Include relevant timestamps where appropriate.';
    }
    
    // Add speaker instruction
    if (settings.includeSpeakers) {
      prompt += ' Identify and reference key speakers when relevant.';
    }
    
    // Add focus areas
    if (settings.focusAreas && settings.focusAreas.length > 0) {
      prompt += ` Focus particularly on: ${settings.focusAreas.join(', ')}.`;
    }
    
    // Add exclude areas
    if (settings.excludeAreas && settings.excludeAreas.length > 0) {
      prompt += ` Avoid focusing on: ${settings.excludeAreas.join(', ')}.`;
    }
    
    // Add language instruction
    if (settings.language && settings.language !== 'English') {
      prompt += ` Provide the summary in ${settings.language}.`;
    }
    
    return prompt;
  };

  const generateSummary = async () => {
    if (!canSummarize) return;

    if (!settings.apiKey.trim()) {
      setError('Please configure your API key first.');
      return;
    }

    if (settings.model === 'custom' && !settings.customModel.trim()) {
      setError('Please enter a custom model ID or select a predefined model.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const bulletPoints = getBulletPointsCount();
      const effectiveModel = settings.model === 'custom' ? settings.customModel : settings.model;
      const customPrompt = buildCustomPrompt();
      
      const result = await summaryAPI.generateSummary(
        videoId, 
        bulletPoints, 
        customPrompt,
        settings.provider,
        effectiveModel,
        settings.apiKey
      );
      
      setSummary(result);
    } catch (error: any) {
      console.error('Failed to generate summary:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  };

  const savePreset = () => {
    if (!newPresetName.trim()) {
      setError('Please enter a preset name.');
      return;
    }

    const newPreset: AIPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      description: newPresetDescription,
      settings: { ...settings },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userPresets = presets.filter(p => !p.isBuiltIn);
    const updatedUserPresets = [...userPresets, newPreset];
    localStorage.setItem('aiPresets', JSON.stringify(updatedUserPresets));
    
    setPresets([...BUILTIN_PRESETS, ...updatedUserPresets]);
    setNewPresetName('');
    setNewPresetDescription('');
    setShowSavePreset(false);
  };

  const loadPreset = (preset: AIPreset) => {
    setSettings(prev => ({ ...prev, ...preset.settings }));
    setShowPresets(false);
  };

  const deletePreset = (presetId: string) => {
    if (!window.confirm('Are you sure you want to delete this preset?')) return;
    
    const userPresets = presets.filter(p => !p.isBuiltIn && p.id !== presetId);
    localStorage.setItem('aiPresets', JSON.stringify(userPresets));
    setPresets([...BUILTIN_PRESETS, ...userPresets]);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !settings.apiKey.trim()) return;

    const userMessage = {
      role: 'user' as const,
      content: chatInput,
      timestamp: new Date()
    };

    const messageToSend = chatInput;
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Convert chat messages to API format
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get effective model
      const effectiveModel = settings.model === 'custom' ? settings.customModel : settings.model;

      const response = await summaryAPI.chatWithVideo(
        videoId,
        messageToSend,
        settings.provider,
        effectiveModel,
        settings.apiKey,
        conversationHistory,
        true // include transcript context
      );

      const assistantMessage = {
        role: 'assistant' as const,
        content: response.message,
        timestamp: new Date(),
        metadata: response.metadata
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        role: 'assistant' as const,
        content: `Sorry, I encountered an error: ${error.response?.data?.detail || error.message || 'Failed to process your message'}. Please check your API key and settings.`,
        timestamp: new Date(),
        isError: true
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      provider: 'openai',
      apiKey: settings.apiKey, // Keep API key
      model: 'gpt-4o-mini',
      customModel: '',
      defaultSummaryLength: 'medium',
      defaultSummaryFormat: 'bullet_points',
      defaultCustomPrompt: 'Provide a clear, objective summary of the key points discussed in this political transcript.',
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      customBulletPoints: undefined,
      includeTimestamps: false,
      includeSpeakers: false,
      focusAreas: [],
      excludeAreas: [],
      tone: 'neutral',
      perspective: 'objective',
      detailLevel: 'medium',
      language: 'English'
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedModel = getModelById(settings.model);
  const effectiveModel = settings.model === 'custom' ? settings.customModel : settings.model;
  const effectiveModelName = settings.model === 'custom' ? (settings.customModel || 'Custom Model') : (selectedModel?.name || settings.model);
  const hasValidConfig = settings.apiKey.trim().length > 0 && (settings.model !== 'custom' || settings.customModel.trim().length > 0);

  if (canSummarize === null) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm text-gray-600 dark:text-gray-300">Checking video...</span>
      </div>
    );
  }

  if (!canSummarize) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/30 dark:border-yellow-800">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-800 dark:text-yellow-300">
            This video cannot be summarized. It has {segmentCount} transcript segments.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Info & Model Info */}
      {!compact && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 dark:bg-gray-800">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <FileText className="h-4 w-4" />
            <span className="font-medium">{videoTitle}</span>
            <span>•</span>
            <span>{segmentCount} segments</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-gray-600 dark:text-gray-300">Using:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100" title={effectiveModel}>
                {effectiveModelName}
              </span>
              <span className="text-gray-500 dark:text-gray-400">via {settings.provider === 'openai' ? 'OpenAI' : 'OpenRouter'}</span>
            </div>
            <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
              hasValidConfig 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                hasValidConfig ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>{hasValidConfig ? 'Configured' : 'Missing API Key'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={generateSummary}
          disabled={isLoading || !hasValidConfig}
          className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            hasValidConfig ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 mr-2" />
              Generate Summary
            </>
          )}
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          AI Chat
        </button>

        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <Save className="h-4 w-4 mr-2" />
          Presets
        </button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Sliders className="h-4 w-4 mr-2" />
          Advanced
        </button>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Presets</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Save Current
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </button>
              <button
                onClick={exportSettings}
                className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </button>
            </div>
          </div>

          {showSavePreset && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 dark:bg-gray-700">
              <input
                type="text"
                placeholder="Preset name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex gap-2">
                <button
                  onClick={savePreset}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSavePreset(false)}
                  className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{preset.name}</span>
                    {preset.isBuiltIn && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs dark:bg-blue-900/30 dark:text-blue-300">
                        Built-in
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{preset.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadPreset(preset)}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    Load
                  </button>
                  {!preset.isBuiltIn && (
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Advanced Settings</h3>
          
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Summary Length
              </label>
              <select
                value={settings.defaultSummaryLength}
                onChange={(e) => updateSetting('defaultSummaryLength', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="short">Short (3 points)</option>
                <option value="medium">Medium (4 points)</option>
                <option value="long">Long (5 points)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Custom Bullet Points
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.customBulletPoints || ''}
                onChange={(e) => updateSetting('customBulletPoints', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Override default (1-10)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Tone
              </label>
              <select
                value={settings.tone}
                onChange={(e) => updateSetting('tone', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="neutral">Neutral</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="analytical">Analytical</option>
                <option value="journalistic">Journalistic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Perspective
              </label>
              <select
                value={settings.perspective}
                onChange={(e) => updateSetting('perspective', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="objective">Objective</option>
                <option value="critical">Critical</option>
                <option value="supportive">Supportive</option>
                <option value="balanced">Balanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Detail Level
              </label>
              <select
                value={settings.detailLevel}
                onChange={(e) => updateSetting('detailLevel', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Language
              </label>
              <input
                type="text"
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                placeholder="e.g., English, Spanish, French"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* AI Model Parameters */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-4 dark:text-gray-100">AI Model Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Temperature ({settings.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Conservative</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  value={settings.maxTokens}
                  onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Top P ({settings.topP})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.topP}
                  onChange={(e) => updateSetting('topP', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Frequency Penalty ({settings.frequencyPenalty})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.frequencyPenalty}
                  onChange={(e) => updateSetting('frequencyPenalty', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Presence Penalty ({settings.presencePenalty})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.presencePenalty}
                  onChange={(e) => updateSetting('presencePenalty', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.includeTimestamps}
                onChange={(e) => updateSetting('includeTimestamps', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Include timestamps in summary</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.includeSpeakers}
                onChange={(e) => updateSetting('includeSpeakers', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Include speaker names</span>
            </label>
          </div>

          {/* Focus Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Focus Areas (comma-separated)
            </label>
            <input
              type="text"
              value={settings.focusAreas?.join(', ') || ''}
              onChange={(e) => updateSetting('focusAreas', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g., economy, healthcare, foreign policy"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Exclude Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Exclude Areas (comma-separated)
            </label>
            <input
              type="text"
              value={settings.excludeAreas?.join(', ') || ''}
              onChange={(e) => updateSetting('excludeAreas', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g., personal attacks, side conversations"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Custom Prompt
            </label>
            <textarea
              value={settings.defaultCustomPrompt}
              onChange={(e) => updateSetting('defaultCustomPrompt', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter custom instructions for the AI..."
            />
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      {showChat && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Chat</h3>
            <button
              onClick={() => {
                setShowChat(false);
                setChatMessages([]);
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 h-64 overflow-y-auto space-y-3 dark:bg-gray-700">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                Start a conversation about this video transcript...
              </div>
            )}
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.isError
                        ? 'bg-red-50 text-red-900 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                        : 'bg-white text-gray-900 border border-gray-200 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.metadata && !message.isError && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-500 text-xs text-gray-500 dark:text-gray-400">
                      <div>Model: {message.metadata.model_used}</div>
                      {message.metadata.has_transcript_context && (
                        <div>Context: {Math.round(message.metadata.transcript_length / 1000)}k chars</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 border border-gray-200 max-w-xs px-3 py-2 rounded-lg text-sm dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Ask about this video..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              disabled={!hasValidConfig}
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || !hasValidConfig || chatLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {!hasValidConfig && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Configure your API key to use the chat feature.
            </p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/30 dark:border-red-800">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Display */}
      {summary && (
        <div className={`rounded-lg p-6 ${
          summary.metadata?.cached 
            ? 'bg-blue-50 border border-blue-200' 
            : 'bg-green-50 border border-green-200'
        } dark:bg-gray-800/40 dark:border-gray-700`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {summary.metadata?.cached ? (
                <Clock className="h-5 w-5 text-blue-600 mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              )}
              <h3 className={`text-lg font-medium ${
                summary.metadata?.cached ? 'text-blue-900 dark:text-blue-300' : 'text-green-900 dark:text-green-300'
              }`}>
                {summary.metadata?.cached ? 'Cached Summary' : 'Summary Generated'}
              </h3>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(summary.summary)}
                className="inline-flex items-center px-3 py-1 text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </button>
              
              {summary.metadata?.cached && (
                <button
                  onClick={() => {
                    summaryAPI.deleteCachedSummary(videoId);
                    setSummary(null);
                  }}
                  className="inline-flex items-center px-3 py-1 text-xs text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800 dark:hover:bg-blue-900/50"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </button>
              )}
            </div>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <div className={`bg-white rounded-lg p-4 border ${
              summary.metadata?.cached ? 'border-blue-200' : 'border-green-200'
            } dark:bg-gray-900 dark:border-gray-700`}>
              <h4 className="text-sm font-medium text-gray-900 mb-3 dark:text-gray-100">{summary.video_title}</h4>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed dark:text-gray-300">
                {summary.summary}
              </div>
            </div>
          </div>

          {/* Summary Metadata */}
          <div className={`mt-4 text-xs space-y-1 ${
            summary.metadata?.cached ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'
          }`}>
            <div className="flex items-center justify-between">
              <span>Bullet Points: {summary.bullet_points}</span>
              <span>Provider: {summary.metadata?.provider_used || (settings.provider === 'openai' ? 'OpenAI' : 'OpenRouter')}</span>
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
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs dark:bg-blue-900/30 dark:text-blue-300">
                  Cached
                </span>
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

export default EnhancedTranscriptSummarizer;