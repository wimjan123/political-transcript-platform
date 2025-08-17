import React from 'react';
import { Bar } from 'react-chartjs-2';
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

  const chartData = {
    labels: sortedData.map(d => truncateLabel(d.speaker, 18)),
    datasets: [
      {
        label: metric === 'segments' ? 'Segments' : 'Words',
        data: sortedData.map(d => d[metric]),
        backgroundColor: metric === 'segments' ? '#6366f1' : '#8b5cf6',
        borderColor: metric === 'segments' ? '#4f46e5' : '#7c3aed',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    onClick: (event: any, activeElements: any) => {
      if (onSpeakerClick && activeElements.length > 0) {
        const index = activeElements[0].index;
        const speaker = sortedData[index].speaker;
        onSpeakerClick(speaker);
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function(context: any) {
            const index = context[0].dataIndex;
            return sortedData[index].speaker;
          },
          label: function(context: any) {
            const index = context.dataIndex;
            const item = sortedData[index];
            return [
              `Segments: ${item.segments.toLocaleString()}`,
              `Words: ${item.words.toLocaleString()}`,
              `Avg words/segment: ${item.segments > 0 ? Math.round(item.words / item.segments) : 0}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatNumber(Number(value));
          }
        }
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          }
        }
      },
    },
  };

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
        <Bar data={chartData} options={chartOptions} />
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