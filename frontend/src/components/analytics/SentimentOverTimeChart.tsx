import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface SentimentDataPoint {
  date: string;
  sentiment: number;
  count: number;
}

interface SentimentOverTimeChartProps {
  data: SentimentDataPoint[];
  isLoading?: boolean;
}

const SentimentOverTimeChart: React.FC<SentimentOverTimeChartProps> = ({ 
  data, 
  isLoading = false 
}) => {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatSentiment = (value: number) => {
    return value.toFixed(3);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-1">
            Week of {formatDate(label)}
          </p>
          <p className="text-sm text-gray-600">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Avg Sentiment: <span className="font-medium">{formatSentiment(data.sentiment)}</span>
          </p>
          <p className="text-sm text-gray-600">
            Segments: <span className="font-medium">{data.count.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Sentiment Over Time</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Sentiment Over Time</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No sentiment data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <TrendingUp className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Sentiment Over Time</h3>
        </div>
        <div className="text-sm text-gray-500">
          Weekly averages
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={formatDate}
              stroke="#6b7280"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatSentiment}
              stroke="#6b7280"
              domain={['dataMin', 'dataMax']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="sentiment" 
              stroke="#2563eb" 
              strokeWidth={2}
              dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Reference line explanation */}
      <div className="mt-4 flex items-center justify-center text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>Positive sentiment &gt; 0</span>
          <span>•</span>
          <span>Negative sentiment &lt; 0</span>
          <span>•</span>
          <span>Neutral ≈ 0</span>
        </div>
      </div>
    </div>
  );
};

export default SentimentOverTimeChart;