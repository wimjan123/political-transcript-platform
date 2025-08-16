import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Search, Sparkles, MessageSquare, Clock, TrendingUp } from 'lucide-react';
import { searchAPI, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import { airtableService } from '../services/airtable';
import type { SearchResponse, TranscriptSegment } from '../types';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  searchResults?: SearchResponse;
  searchQuery?: string;
}

interface ConversationalSearchProps {
  onClose?: () => void;
  className?: string;
}

const ConversationalSearch: React.FC<ConversationalSearchProps> = ({ onClose, className = '' }) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI search assistant. I can help you search through political transcripts using natural language. Try asking me something like 'Find speeches about healthcare by Biden' or 'Show me negative sentiment segments about the economy'.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef<string>(airtableService.generateSessionId());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const extractSearchParams = (query: string): { 
    searchQuery: string; 
    filters: Record<string, any>;
    mode: 'lexical' | 'hybrid' | 'semantic';
  } => {
    const lowerQuery = query.toLowerCase();
    const filters: Record<string, any> = {};
    let mode: 'lexical' | 'hybrid' | 'semantic' = 'hybrid'; // Default to hybrid for conversational queries
    let searchQuery = query;

    // Extract speaker names
    const speakerPatterns = [
      /(?:by|from|speaker|said by)\s+([a-zA-Z\s]+?)(?:\s|$|[.,;])/gi,
      /([a-zA-Z\s]+?)\s+(?:said|says|spoke about|mentioned)/gi,
    ];
    
    for (const pattern of speakerPatterns) {
      const match = pattern.exec(lowerQuery);
      if (match) {
        filters.speaker = match[1].trim();
        break;
      }
    }

    // Extract sentiment
    if (lowerQuery.includes('positive sentiment') || lowerQuery.includes('positive tone')) {
      filters.min_sentiment_lmd = 0.1;
    } else if (lowerQuery.includes('negative sentiment') || lowerQuery.includes('negative tone')) {
      filters.max_sentiment_lmd = -0.1;
    }

    // Extract topics/subjects
    const topicKeywords = [
      'healthcare', 'economy', 'education', 'immigration', 'climate', 'jobs', 
      'taxes', 'foreign policy', 'defense', 'social security', 'medicare'
    ];
    
    for (const topic of topicKeywords) {
      if (lowerQuery.includes(topic)) {
        // Use the topic as part of the search query rather than a filter
        searchQuery = `${topic} ${searchQuery}`.trim();
        break;
      }
    }

    // Extract time periods
    const currentYear = new Date().getFullYear();
    if (lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
      filters.date_from = `${currentYear - 1}-01-01`;
    } else if (lowerQuery.includes('last year')) {
      filters.date_from = `${currentYear - 1}-01-01`;
      filters.date_to = `${currentYear - 1}-12-31`;
    }

    // Determine search mode based on query complexity
    if (lowerQuery.includes('similar') || lowerQuery.includes('like') || lowerQuery.includes('related')) {
      mode = 'semantic';
    } else if (lowerQuery.includes('exact') || lowerQuery.includes('precisely')) {
      mode = 'lexical';
    }

    // Clean up search query by removing filter-related phrases
    searchQuery = searchQuery
      .replace(/(?:by|from|speaker|said by)\s+[a-zA-Z\s]+/gi, '')
      .replace(/(?:positive|negative)\s+(?:sentiment|tone)/gi, '')
      .replace(/(?:recent|latest|last year)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { searchQuery, filters, mode };
  };

  const performConversationalSearch = async (userQuery: string): Promise<{ searchResults: SearchResponse; searchQuery: string }> => {
    const { searchQuery, filters, mode } = extractSearchParams(userQuery);
    
    if (!searchQuery) {
      throw new Error('I need more specific search terms to find relevant content.');
    }

    const searchParams = {
      q: searchQuery,
      page: 1,
      page_size: 10,
      mode,
      index: 'segments',
      ...filters,
    };

    try {
      const results = await searchAPI.searchMeili(searchParams);
      
      if (results.total === 0) {
        // Try with different mode if no results
        const fallbackResults = await searchAPI.searchMeili({
          ...searchParams,
          mode: mode === 'semantic' ? 'hybrid' : 'semantic',
        });
        
        return { searchResults: fallbackResults, searchQuery };
      }
      
      return { searchResults: results, searchQuery };
    } catch (error) {
      // Fallback to PostgreSQL search
      const fallbackResults = await searchAPI.search({
        q: searchQuery,
        page: 1,
        page_size: 10,
        ...filters,
      });
      
      return { searchResults: fallbackResults, searchQuery };
    }
  };

  const generateResponse = (searchResults: SearchResponse, searchQuery: string, userQuery: string): string => {
    const { total, results } = searchResults;
    
    if (total === 0) {
      return `I couldn't find any segments matching "${userQuery}". Try rephrasing your query or using different keywords.`;
    }

    const speakers = [...new Set(results.map(r => r.speaker_name).filter(Boolean))];
    const speakerText = speakers.length > 0 ? ` from ${speakers.slice(0, 3).join(', ')}${speakers.length > 3 ? ' and others' : ''}` : '';
    
    let response = `I found ${total} segment${total === 1 ? '' : 's'} matching "${searchQuery}"${speakerText}. `;
    
    if (results.length > 0) {
      const firstSegment = results[0];
      const sentimentInfo = typeof firstSegment.sentiment_loughran_score === 'number' 
        ? ` (${getSentimentLabel(firstSegment.sentiment_loughran_score)} sentiment)`
        : '';
      
      response += `The top result is from ${firstSegment.speaker_name || 'an unknown speaker'}${sentimentInfo}.`;
    }
    
    response += ' Click on any segment below to view it in context or navigate to the full video.';
    
    return response;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const { searchResults, searchQuery } = await performConversationalSearch(userMessage.content);
      const responseTime = Date.now() - startTime;
      const responseContent = generateResponse(searchResults, searchQuery, userMessage.content);
      
      const assistantMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        searchResults,
        searchQuery,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Log to Airtable (async, non-blocking)
      const { searchQuery: extractedQuery, filters, mode } = extractSearchParams(userMessage.content);
      airtableService.logConversationalQuery({
        userQuery: userMessage.content,
        extractedSearchQuery: extractedQuery,
        searchMode: mode,
        filters,
        resultCount: searchResults.total,
        responseTime,
        sessionId: sessionId.current,
        language: 'auto', // Could be enhanced to detect language
      }).catch(error => {
        console.warn('Failed to log query to Airtable:', error);
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: error.message || 'I encountered an error while searching. Please try again with a different query.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);

      // Log error queries too for analytics
      airtableService.logConversationalQuery({
        userQuery: userMessage.content,
        extractedSearchQuery: '',
        searchMode: 'hybrid',
        filters: {},
        resultCount: 0,
        responseTime,
        sessionId: sessionId.current,
        language: 'auto',
      }).catch(logError => {
        console.warn('Failed to log error query to Airtable:', logError);
      });
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

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-2">
          <Bot className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Search Assistant</h2>
          <Sparkles className="h-4 w-4 text-purple-500" />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3`}>
              <div className="flex items-center space-x-2 mb-1">
                {message.type === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-xs opacity-75">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{message.content}</p>
              
              {/* Search Results */}
              {message.searchResults && message.searchResults.results.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.searchResults.results.slice(0, 5).map((segment) => (
                    <div
                      key={segment.id}
                      className="bg-white border border-gray-200 rounded-md p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                      onClick={() => handleSegmentClick(segment)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs font-medium text-gray-900">{segment.speaker_name}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          {typeof segment.video_seconds === 'number' && (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(segment.video_seconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-700 leading-relaxed" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {segment.transcript_text}
                      </p>
                      
                      {segment.video && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {segment.video.title}
                        </p>
                      )}
                      
                      {typeof segment.sentiment_loughran_score === 'number' && (
                        <div className="flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          <span className={`text-xs ${getSentimentColor(segment.sentiment_loughran_score)}`}>
                            {getSentimentLabel(segment.sentiment_loughran_score)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {message.searchResults.total > 5 && (
                    <p className="text-xs text-gray-600 mt-2">
                      ... and {message.searchResults.total - 5} more results
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 text-blue-600" />
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Searching...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything about the transcripts..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "Find speeches about healthcare by Biden",
            "Show me negative sentiment segments about the economy",
            "Recent speeches about climate change",
            "Find similar segments about education policy"
          ].map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setInputValue(suggestion)}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default ConversationalSearch;