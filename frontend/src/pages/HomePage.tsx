import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, BarChart3, Video, TrendingUp, Users, MessageSquare, Calendar } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import type { AnalyticsStats } from '../types';

const HomePage: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await analyticsAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-pink-600/10"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="text-center">
                <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="block bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">Search Political</span>
                  <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Transcripts</span>
                </h1>
                <p className="mt-6 max-w-md mx-auto text-base text-gray-600 sm:text-lg md:mt-8 md:text-xl md:max-w-3xl leading-relaxed">
                  Advanced search and analytics platform for political video transcripts. 
                  Discover insights through powerful full-text search, sentiment analysis, 
                  and comprehensive analytics.
                </p>

                {/* Search Bar */}
                <div className="mt-10 max-w-2xl mx-auto">
                  <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-12 pr-32 py-4 border border-gray-300/50 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-base shadow-xl hover:shadow-2xl transition-all duration-300"
                      placeholder="Search transcripts, speakers, topics..."
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                      <button
                        type="submit"
                        className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        Search
                      </button>
                    </div>
                  </form>
                  
                  {/* Quick Search Suggestions */}
                  <div className="mt-6 flex flex-wrap justify-center gap-2 items-center">
                    <span className="text-sm text-gray-500 font-medium">Try:</span>
                    {['immigration', 'healthcare', 'economy', 'climate change'].map((term) => (
                      <button
                        key={term}
                        onClick={() => setSearchQuery(term)}
                        className="inline-flex items-center px-4 py-2 rounded-full text-xs font-medium bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80 hover:text-gray-900 border border-gray-200/50 hover:border-gray-300/50 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="mt-10 flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <Link
                    to="/search"
                    className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Search className="h-5 w-5 mr-2" />
                    Advanced Search
                  </Link>
                  <Link
                    to="/analytics"
                    className="inline-flex items-center justify-center px-8 py-3 border border-gray-300/50 text-base font-semibold rounded-xl text-gray-700 bg-white/80 backdrop-blur-sm hover:bg-white/90 hover:border-gray-400/50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <BarChart3 className="h-5 w-5 mr-2" />
                    View Analytics
                  </Link>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Videos */}
            <div className="bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl rounded-2xl border border-gray-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 truncate">
                        Total Videos
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900 mt-1">
                        {isLoading ? '...' : formatNumber(stats.total_videos)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Segments */}
            <div className="bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl rounded-2xl border border-gray-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 truncate">
                        Transcript Segments
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900 mt-1">
                        {isLoading ? '...' : formatNumber(stats.total_segments)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Speakers */}
            <div className="bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl rounded-2xl border border-gray-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 truncate">
                        Speakers
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900 mt-1">
                        {isLoading ? '...' : formatNumber(stats.total_speakers)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Topics */}
            <div className="bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl rounded-2xl border border-gray-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 truncate">
                        Topics
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900 mt-1">
                        {isLoading ? '...' : formatNumber(stats.total_topics)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="py-20 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-4 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Powerful Political Analysis Tools
            </p>
            <p className="mt-6 max-w-3xl text-xl text-gray-600 lg:mx-auto leading-relaxed">
              Comprehensive platform for searching, analyzing, and understanding political discourse
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {/* Advanced Search */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                    Advanced Search
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Full-text search with fuzzy matching, exact phrase search, and Boolean operators.
                  Filter by speaker, source, topic, sentiment, and readability.
                </dd>
              </div>

              {/* Sentiment Analysis */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                    Sentiment Analysis
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Multiple sentiment analysis algorithms including Loughran-McDonald, Harvard-IV,
                  and VADER for comprehensive emotional context.
                </dd>
              </div>

              {/* Content Analytics */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                    Content Analytics
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Topic classification, readability metrics, content moderation scores,
                  and comprehensive speaker analytics with visualization.
                </dd>
              </div>

              {/* Export & API */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                    Export & API
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  Export search results to CSV or JSON. RESTful API for programmatic access
                  to all platform features and data.
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Speakers/Topics Section */}
      {stats && !isLoading && (
        <div className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Speakers */}
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Most Active Speakers
                </h3>
                <div className="space-y-3">
                  {stats.top_speakers.slice(0, 5).map((speaker, index) => (
                    <div key={speaker.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {speaker.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(speaker.segment_count)} segments
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    to="/analytics"
                    className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                  >
                    View all speaker analytics →
                  </Link>
                </div>
              </div>

              {/* Top Topics */}
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Most Discussed Topics
                </h3>
                <div className="space-y-3">
                  {stats.top_topics.slice(0, 5).map((topic, index) => (
                    <div key={topic.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {topic.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(topic.frequency)} mentions
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    to="/analytics"
                    className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                  >
                    View all topic analytics →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;