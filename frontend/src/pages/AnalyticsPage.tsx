import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MessageSquare, Calendar, Filter } from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  LineElement,
  PointElement,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { analyticsAPI } from '../services/api';
import type { AnalyticsStats, SentimentAnalytics, TopicAnalytics } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [sentimentAnalytics, setSentimentAnalytics] = useState<SentimentAnalytics | null>(null);
  const [topicAnalytics, setTopicAnalytics] = useState<TopicAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, just load the basic stats that work
      const statsData = await analyticsAPI.getStats(dateFilter.from || undefined, dateFilter.to || undefined);

      setStats(statsData);
      // Set empty data for now until backend is fully working
      setSentimentAnalytics({
        by_speaker: [],
        by_topic: [],
        by_date: [],
        distribution: {},
        average_scores: { loughran: 0, harvard: 0, vader: 0 }
      });
      setTopicAnalytics({
        topic_distribution: [],
        topic_trends: [],
        speaker_topics: [],
        topic_sentiment: []
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyDateFilter = () => {
    loadAnalytics();
  };

  const clearDateFilter = () => {
    setDateFilter({ from: '', to: '' });
    setTimeout(loadAnalytics, 100);
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

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Top speakers chart data
  const topSpeakersChartData = stats ? {
    labels: stats.top_speakers.slice(0, 10).map(s => s.name),
    datasets: [
      {
        label: 'Segments',
        data: stats.top_speakers.slice(0, 10).map(s => s.segment_count),
        backgroundColor: 'rgba(37, 99, 235, 0.8)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
      },
    ],
  } : null;

  // Sentiment distribution chart data
  const sentimentDistributionData = stats ? {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [
      {
        data: [
          stats.sentiment_distribution.positive || 0,
          stats.sentiment_distribution.neutral || 0,
          stats.sentiment_distribution.negative || 0,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(107, 114, 128, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(107, 114, 128, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  } : null;

  // Sentiment by speaker chart data
  const sentimentBySpeakerData = sentimentAnalytics ? {
    labels: sentimentAnalytics.by_speaker.slice(0, 10).map(s => s.speaker),
    datasets: [
      {
        label: 'Average Sentiment',
        data: sentimentAnalytics.by_speaker.slice(0, 10).map(s => s.avg_sentiment),
        backgroundColor: sentimentAnalytics.by_speaker.slice(0, 10).map(s => 
          s.avg_sentiment > 0 ? 'rgba(34, 197, 94, 0.8)' : 
          s.avg_sentiment < 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(107, 114, 128, 0.8)'
        ),
        borderColor: sentimentAnalytics.by_speaker.slice(0, 10).map(s => 
          s.avg_sentiment > 0 ? 'rgba(34, 197, 94, 1)' : 
          s.avg_sentiment < 0 ? 'rgba(239, 68, 68, 1)' : 'rgba(107, 114, 128, 1)'
        ),
        borderWidth: 1,
      },
    ],
  } : null;

  // Top topics chart data
  const topTopicsChartData = topicAnalytics ? {
    labels: topicAnalytics.topic_distribution.slice(0, 10).map(t => t.topic),
    datasets: [
      {
        label: 'Frequency',
        data: topicAnalytics.topic_distribution.slice(0, 10).map(t => t.frequency),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
      },
    ],
  } : null;

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
            onClick={loadAnalytics}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive analytics and insights from political transcript data
          </p>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Date Range Filter</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="label">From Date</label>
              <input
                type="date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">To Date</label>
              <input
                type="date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <button
                onClick={applyDateFilter}
                className="btn btn-primary w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply Filter
              </button>
            </div>
            <div>
              <button
                onClick={clearDateFilter}
                className="btn btn-outline w-full"
              >
                Clear Filter
              </button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        {stats && (
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
                        {formatNumber(stats.total_videos)}
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
                        {formatNumber(stats.total_segments)}
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
                        {formatNumber(stats.total_speakers)}
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
                    <TrendingUp className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Topics
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatNumber(stats.total_topics)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Speakers Chart */}
          {topSpeakersChartData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Most Active Speakers</h3>
              <div className="h-80">
                <Bar data={topSpeakersChartData} options={chartOptions} />
              </div>
            </div>
          )}

          {/* Sentiment Distribution Chart */}
          {sentimentDistributionData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sentiment Distribution</h3>
              <div className="h-80 flex items-center justify-center">
                <Doughnut 
                  data={sentimentDistributionData} 
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      },
                    },
                  }} 
                />
              </div>
            </div>
          )}

          {/* Sentiment by Speaker Chart */}
          {sentimentBySpeakerData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Average Sentiment by Speaker</h3>
              <div className="h-80">
                <Bar 
                  data={sentimentBySpeakerData} 
                  options={{
                    ...chartOptions,
                    scales: {
                      y: {
                        beginAtZero: false,
                      },
                    },
                  }} 
                />
              </div>
            </div>
          )}

          {/* Top Topics Chart */}
          {topTopicsChartData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Most Discussed Topics</h3>
              <div className="h-80">
                <Bar data={topTopicsChartData} options={chartOptions} />
              </div>
            </div>
          )}
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Speakers Table */}
          {stats && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Speaker Statistics</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Speaker
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Segments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Sentiment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.top_speakers.slice(0, 10).map((speaker, index) => (
                      <tr key={speaker.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {speaker.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(speaker.segment_count)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            speaker.avg_sentiment > 0 
                              ? 'bg-green-100 text-green-800' 
                              : speaker.avg_sentiment < 0 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {speaker.avg_sentiment.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Topics Table */}
          {stats && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Topic Statistics</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Topic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Frequency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.top_topics.slice(0, 10).map((topic, index) => (
                      <tr key={topic.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {topic.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(topic.frequency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {topic.avg_score.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Date Range Info */}
        {stats && stats.date_range && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-400 mr-3" />
              <div className="text-blue-700">
                <p className="text-sm">
                  Data spans from{' '}
                  <span className="font-medium">
                    {stats.date_range.min_date || 'N/A'}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {stats.date_range.max_date || 'N/A'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;