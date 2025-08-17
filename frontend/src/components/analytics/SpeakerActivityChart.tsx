import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

interface SpeakerActivityDataPoint {
  speaker: string;
  segments: number;
  words: number;
}

interface SpeakerActivityChartProps {
  data: SpeakerActivityDataPoint[];
  isLoading?: boolean;
  onSpeakerClick?: (speaker: string) => void;
  metric?: 'segments' | 'words';
}

const SpeakerActivityChart: React.FC<SpeakerActivityChartProps> = ({ 
  data, 
  isLoading = false,
  onSpeakerClick,
  metric = 'segments'
}) => {
  const truncateLabel = (str: string, maxLength: number = 20) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <p className="font-medium text-gray-900 mb-2">
            {label}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              <span className="inline-block w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
              Segments: <span className="font-medium">{data.segments.toLocaleString()}</span>
            </p>
            <p className="text-sm text-gray-600">
              <span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
              Words: <span className="font-medium">{data.words.toLocaleString()}</span>
            </p>
            <p className="text-sm text-gray-500">
              Avg words/segment: <span className="font-medium">
                {data.segments > 0 ? Math.round(data.words / data.segments) : 0}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (data: any) => {
    if (onSpeakerClick && data.speaker) {
      onSpeakerClick(data.speaker);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Speaker Activity</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Speaker Activity</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No speaker data available</p>
        </div>
      </div>
    );
  }

  // Sort data by the selected metric
  const sortedData = [...data].sort((a, b) => b[metric] - a[metric]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Speaker Activity</h3>
        </div>
        <div className="text-sm text-gray-500">
          Top {sortedData.length} by {metric}
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={sortedData} 
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              type="number"
              tick={{ fontSize: 12 }}
              tickFormatter={formatNumber}
              stroke="#6b7280"
            />
            <YAxis 
              type="category"
              dataKey="speaker" 
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => truncateLabel(value, 18)}
              stroke="#6b7280"
              width={110}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey={metric}
              fill={metric === 'segments' ? "#6366f1" : "#8b5cf6"}
              radius={[0, 2, 2, 0]}
              onClick={handleBarClick}
              className={onSpeakerClick ? "cursor-pointer hover:opacity-80" : ""}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <p className="text-gray-500">Total Speakers</p>
          <p className="font-medium text-gray-900">{data.length}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Total Segments</p>
          <p className="font-medium text-gray-900">
            {data.reduce((sum, s) => sum + s.segments, 0).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Total Words</p>
          <p className="font-medium text-gray-900">
            {formatNumber(data.reduce((sum, s) => sum + s.words, 0))}
          </p>
        </div>
      </div>
      
      {onSpeakerClick && (
        <div className="mt-2 text-center">
          <span className="text-xs text-indigo-600">Click bars to filter by speaker</span>
        </div>
      )}
    </div>
  );
};

export default SpeakerActivityChart;