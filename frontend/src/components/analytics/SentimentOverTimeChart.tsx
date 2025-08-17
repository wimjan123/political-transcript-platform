import React from 'react';
import { Line } from 'react-chartjs-2';
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

  const chartData = {
    labels: data.map(d => formatDate(d.date)),
    datasets: [
      {
        label: 'Average Sentiment',
        data: data.map(d => d.sentiment),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#2563eb',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          afterLabel: function(context: any) {
            const index = context.dataIndex;
            return `Segments: ${data[index].count.toLocaleString()}`;
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
          maxTicksLimit: 10,
        }
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return value.toFixed(3);
          }
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

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
        <Line data={chartData} options={chartOptions} />
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