import React, { useState, useEffect } from 'react';
import { Bot, Key, Settings, Eye, EyeOff, Save, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { summaryAPI } from '../services/api';
import TranscriptSummarizer from '../components/TranscriptSummarizer';
import type { AISettings } from '../types';

const AISettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AISettings>({
    apiKey: '',
    defaultSummaryLength: 'medium',
    defaultSummaryFormat: 'bullet_points',
    defaultCustomPrompt: 'Provide a clear, objective summary of the key points discussed in this political transcript. Focus on policy positions, major statements, and significant topics covered.',
  });
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [testVideoId, setTestVideoId] = useState<string>('');

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to parse saved AI settings:', error);
      }
    }

    // Load model information
    loadModelInfo();
  }, []);

  const loadModelInfo = async () => {
    try {
      const info = await summaryAPI.getModelInfo();
      setModelInfo(info);
    } catch (error) {
      console.error('Failed to load model info:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus('idle');
    
    try {
      // Save to localStorage
      localStorage.setItem('aiSettings', JSON.stringify(settings));
      setSaveStatus('success');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: keyof AISettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getSummaryLengthDescription = (length: string) => {
    switch (length) {
      case 'short': return '3 bullet points - Quick overview';
      case 'medium': return '4 bullet points - Balanced summary';
      case 'long': return '5 bullet points - Comprehensive summary';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Settings</h1>
              <p className="text-gray-600">Configure AI-powered transcript summarization</p>
            </div>
          </div>
        </div>

        {/* Model Information Card */}
        {modelInfo && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Summarization Service Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">OpenAI Available:</span>
                <span className={`ml-2 font-medium ${modelInfo.openai_available ? 'text-green-600' : 'text-red-600'}`}>
                  {modelInfo.openai_available ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Primary Model:</span>
                <span className="ml-2 font-medium">
                  {modelInfo.primary_model || 'Not configured'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Fallback Method:</span>
                <span className="ml-2 font-medium">{modelInfo.fallback_method}</span>
              </div>
              <div>
                <span className="text-gray-500">Supported Bullet Points:</span>
                <span className="ml-2 font-medium">
                  {modelInfo.supported_bullet_points?.min}-{modelInfo.supported_bullet_points?.max}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Key className="h-5 w-5 mr-2" />
            API Configuration
          </h2>

          {/* API Key Input */}
          <div className="mb-6">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              LLM API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                id="apiKey"
                value={settings.apiKey}
                onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                placeholder="Enter your OpenAI or compatible API key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Your API key is stored locally in your browser and never sent to our servers
            </p>
          </div>

          {/* Default Summary Length */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Summary Length
            </label>
            <div className="space-y-2">
              {(['short', 'medium', 'long'] as const).map((length) => (
                <label key={length} className="flex items-center">
                  <input
                    type="radio"
                    name="summaryLength"
                    value={length}
                    checked={settings.defaultSummaryLength === length}
                    onChange={(e) => handleSettingChange('defaultSummaryLength', e.target.value)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm text-gray-700 capitalize">
                    {length}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {getSummaryLengthDescription(length)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Default Summary Format */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Summary Format
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="summaryFormat"
                  value="bullet_points"
                  checked={settings.defaultSummaryFormat === 'bullet_points'}
                  onChange={(e) => handleSettingChange('defaultSummaryFormat', e.target.value)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-700">Bullet Points</span>
                <span className="ml-2 text-xs text-gray-500">Structured list format</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="summaryFormat"
                  value="paragraph"
                  checked={settings.defaultSummaryFormat === 'paragraph'}
                  onChange={(e) => handleSettingChange('defaultSummaryFormat', e.target.value)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-700">Paragraph</span>
                <span className="ml-2 text-xs text-gray-500">Flowing text format</span>
              </label>
            </div>
          </div>

          {/* Default Custom Prompt */}
          <div className="mb-6">
            <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 mb-2">
              Default Custom Prompt
            </label>
            <textarea
              id="customPrompt"
              value={settings.defaultCustomPrompt}
              onChange={(e) => handleSettingChange('defaultCustomPrompt', e.target.value)}
              rows={4}
              placeholder="Enter default instructions for the AI summarization..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              This prompt will guide the AI in generating summaries. You can override this for individual summaries.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn btn-primary flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {/* Save Status */}
            {saveStatus === 'success' && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="h-4 w-4 mr-2" />
                Settings saved successfully
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                Failed to save settings
              </div>
            )}
          </div>
        </div>

        {/* Test Summarization */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Sparkles className="h-5 w-5 mr-2" />
            Test Summarization
          </h2>
          
          <div className="mb-4">
            <label htmlFor="testVideoId" className="block text-sm font-medium text-gray-700 mb-2">
              Video ID to Test
            </label>
            <input
              type="number"
              id="testVideoId"
              value={testVideoId}
              onChange={(e) => setTestVideoId(e.target.value)}
              placeholder="Enter a video ID to test summarization"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Test the summarization feature with a specific video ID
            </p>
          </div>

          {testVideoId && (
            <TranscriptSummarizer
              videoId={parseInt(testVideoId)}
              defaultSettings={settings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AISettingsPage;