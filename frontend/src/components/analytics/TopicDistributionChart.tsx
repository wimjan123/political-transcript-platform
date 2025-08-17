import React from 'react';
import { Bar } from 'react-chartjs-2';
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

  const chartData = {
    labels: dataWithPercentages.map(d => truncateLabel(d.topic, 12)),
    datasets: [
      {
        label: 'Topic Count',
        data: dataWithPercentages.map(d => d.count),
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event: any, activeElements: any) => {
      if (onTopicClick && activeElements.length > 0) {
        const index = activeElements[0].index;
        const topic = dataWithPercentages[index].topic;
        onTopicClick(topic);
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
            return dataWithPercentages[index].topic;
          },
          label: function(context: any) {
            const index = context.dataIndex;
            const item = dataWithPercentages[index];
            return [
              `Count: ${item.count.toLocaleString()}`,
              `Percentage: ${item.percentage.toFixed(1)}%`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return value.toLocaleString();
          }
        }
      },
    },
  };

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
        <Bar data={chartData} options={chartOptions} />
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