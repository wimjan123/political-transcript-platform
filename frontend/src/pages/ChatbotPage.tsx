import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader, MessageCircle, Database, Settings, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import type { AISettings } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}


const ChatbotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'openrouter',
    apiKey: '',
    model: 'anthropic/claude-3.5-sonnet',
    customModel: '',
    defaultSummaryLength: 'medium',
    defaultSummaryFormat: 'bullet_points',
    defaultCustomPrompt: ''
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load AI settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setAiSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to parse saved AI settings:', error);
      }
    }
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const testConnection = async () => {
    if (!aiSettings.apiKey) {
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('testing');
    try {
      const actualModel = aiSettings.model === 'custom' ? aiSettings.customModel : aiSettings.model;
      const response = await fetch('/api/chatbot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiSettings.apiKey,
          model: actualModel
        })
      });

      if (response.ok) {
        setConnectionStatus('success');
        setTimeout(() => setConnectionStatus('idle'), 3000);
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !aiSettings.apiKey || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const actualModel = aiSettings.model === 'custom' ? aiSettings.customModel : aiSettings.model;
      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          apiKey: aiSettings.apiKey,
          model: actualModel,
          temperature: 0.7, // Use a reasonable default for chat
          maxTokens: 4000, // Use a reasonable default for chat
          conversationHistory: messages.slice(-10) // Send last 10 messages for context
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please check your API key and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">AI Chatbot</h1>
                <p className="text-gray-600 dark:text-gray-300">Chat with AI about your political transcript database</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="/ai-settings"
                className="btn btn-secondary flex items-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                AI Settings
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
              <button
                onClick={testConnection}
                disabled={connectionStatus === 'testing' || !aiSettings.apiKey}
                className="btn btn-outline flex items-center"
              >
                {connectionStatus === 'testing' ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </button>
              <button
                onClick={clearChat}
                className="btn btn-outline"
              >
                Clear Chat
              </button>
            </div>
          </div>

          {/* AI Settings Status */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6 dark:from-blue-900/20 dark:to-purple-900/20 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Database Connected • AI Model: {aiSettings.model === 'custom' ? aiSettings.customModel || 'Custom Model' : aiSettings.model}
                </span>
                {connectionStatus === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {connectionStatus === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300">
                {aiSettings.apiKey ? '🔑 API Key Configured' : '⚠️ No API Key'}
              </div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Ask questions about videos, transcripts, speakers, topics, and analytics. Configure your OpenRouter API key in AI Settings to get started.
            </p>
          </div>
        </div>


        {/* Chat Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700" style={{ height: 'calc(100vh - 320px)' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ height: 'calc(100% - 80px)' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Start a conversation
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Ask questions about your political transcript database. For example:
                </p>
                <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <p>• "How many videos are in the database?"</p>
                  <p>• "What are the most frequent topics discussed?"</p>
                  <p>• "Find transcripts mentioning climate change"</p>
                  <p>• "Show sentiment analysis for recent videos"</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl px-4 py-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div
                        className={`text-xs mt-2 ${
                          message.role === 'user'
                            ? 'text-green-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-gray-600 dark:text-gray-300">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Form */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={aiSettings.apiKey ? "Ask a question about your database..." : "Please configure your API key in AI Settings first"}
                disabled={!aiSettings.apiKey || isLoading}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
              />
              <button
                type="submit"
                disabled={!input.trim() || !aiSettings.apiKey || isLoading}
                className="btn btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;