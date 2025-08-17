import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Hash } from 'lucide-react';

interface TopicDataPoint {
  topic: string;
  count: number;
  percentage?: number;
}

interface TopicDistributionChartProps {
  data: TopicDataPoint[];
  isLoading?: boolean;
  onTopicClick?: (topic: string) => void;
}

const TopicDistributionChart: React.FC<TopicDistributionChartProps> = ({ 
  data, 
  isLoading = false,
  onTopicClick 
}) => {
  const truncateLabel = (str: string, maxLength: number = 15) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-1">
            {label}
          </p>
          <p className="text-sm text-gray-600">
            <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
            Count: <span className="font-medium">{data.count.toLocaleString()}</span>
          </p>
          {data.percentage && (
            <p className="text-sm text-gray-600">
              Percentage: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (data: any) => {
    if (onTopicClick && data.topic) {
      onTopicClick(data.topic);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Hash className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Topic Distribution</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Hash className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Topic Distribution</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No topic data available</p>
        </div>
      </div>
    );
  }

  // Calculate percentages if not provided
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const dataWithPercentages = data.map(item => ({
    ...item,
    percentage: item.percentage || (item.count / total) * 100
  }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Hash className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Topic Distribution</h3>
        </div>
        <div className="text-sm text-gray-500">
          Top {data.length} topics
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={dataWithPercentages} 
            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="topic" 
              tick={{ fontSize: 11 }}
              tickFormatter={(value: string) => truncateLabel(value, 12)}
              stroke="#6b7280"
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="count" 
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              onClick={handleBarClick}
              className={onTopicClick ? "cursor-pointer hover:opacity-80" : ""}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Total topics: {data.length}</span>
        <span>Total mentions: {total.toLocaleString()}</span>
        {onTopicClick && (
          <span className="text-emerald-600">Click bars to filter by topic</span>
        )}
      </div>
    </div>
  );
};

export default TopicDistributionChart;