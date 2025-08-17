import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, MessageSquare, Activity, Bot } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import SentimentOverTimeChart from '../components/analytics/SentimentOverTimeChart';
import TopicDistributionChart from '../components/analytics/TopicDistributionChart';
import SpeakerActivityChart from '../components/analytics/SpeakerActivityChart';
import ContentModerationSummary from '../components/analytics/ContentModerationSummary';
import GlobalFilters from '../components/analytics/GlobalFilters';
import type { DashboardAnalytics, DashboardFilters } from '../types';

const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'content' | 'conversational'>('content');
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: '',
    dateTo: '',
    speakers: [],
    topics: []
  });
  
  // Mock data for filter dropdowns - in real app, fetch from API
  const [availableSpeakers] = useState<string[]>([]);
  const [availableTopics] = useState<string[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await analyticsAPI.getDashboardAnalytics(filters);
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard analytics:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleFiltersChange = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
  };

  const handleTopicClick = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    setFilters({ ...filters, topics: newTopics });
  };

  const handleSpeakerClick = (speaker: string) => {
    const newSpeakers = filters.speakers.includes(speaker)
      ? filters.speakers.filter(s => s !== speaker)
      : [...filters.speakers, speaker];
    setFilters({ ...filters, speakers: newSpeakers });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-3">Analytics Dashboard</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Comprehensive analytics and insights from political transcript data
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('content')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'content'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                Content Analytics
              </button>
              <button
                onClick={() => setActiveTab('conversational')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'conversational'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Bot className="h-4 w-4 inline mr-2" />
                Conversational Search Analytics
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'content' && (
          <>
            {/* Global Filters */}
            <GlobalFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              isLoading={isLoading}
              availableSpeakers={availableSpeakers}
              availableTopics={availableTopics}
            />

            {/* KPI Stats */}
            {dashboardData && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <BarChart3 className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Videos
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(dashboardData.kpi_stats.total_videos)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <MessageSquare className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Transcript Segments
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(dashboardData.kpi_stats.total_segments)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Speakers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(dashboardData.kpi_stats.total_speakers)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Activity className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Reading Level
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {dashboardData.readability_metrics.avg_grade_level.toFixed(1)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Dashboard Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Sentiment Over Time */}
              <div className="lg:col-span-2">
                <SentimentOverTimeChart
                  data={dashboardData?.sentiment_over_time || []}
                  isLoading={isLoading}
                />
              </div>

              {/* Topic Distribution */}
              <TopicDistributionChart
                data={dashboardData?.topic_distribution || []}
                isLoading={isLoading}
                onTopicClick={handleTopicClick}
              />

              {/* Speaker Activity */}
              <SpeakerActivityChart
                data={dashboardData?.speaker_activity || []}
                isLoading={isLoading}
                onSpeakerClick={handleSpeakerClick}
                metric="segments"
              />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Content Moderation */}
              <div className="lg:col-span-2">
                <ContentModerationSummary
                  data={dashboardData?.content_moderation_summary || []}
                  isLoading={isLoading}
                />
              </div>

              {/* Sentiment by Speaker */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-5 w-5 text-gray-400 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Top Sentiment by Speaker</h3>
                </div>
                
                {isLoading ? (
                  <div className="h-60 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData?.sentiment_by_speaker.slice(0, 8).map((item, index) => (
                      <div key={item.speaker} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.speaker}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.segments} segments
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.sentiment > 0.1 
                              ? 'bg-green-100 text-green-800' 
                              : item.sentiment < -0.1 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.sentiment.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Conversational Analytics Tab */}
        {activeTab === 'conversational' && (
          <AnalyticsDashboard />
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;