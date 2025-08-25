import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface SentimentTagProps {
  sentiment: string | null | undefined;
  className?: string;
}

export const SentimentTag: React.FC<SentimentTagProps> = ({ sentiment, className = '' }) => {
  if (!sentiment) return null;

  const getSentimentStyles = (label: string) => {
    switch (label.toLowerCase()) {
      case 'very negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'negative':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'neutral':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'very positive':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getSentimentIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'very negative':
      case 'negative':
        return <TrendingDown className="h-3 w-3 mr-1" />;
      case 'neutral':
        return <Minus className="h-3 w-3 mr-1" />;
      case 'positive':
      case 'very positive':
        return <TrendingUp className="h-3 w-3 mr-1" />;
      default:
        return <Minus className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSentimentStyles(sentiment)} ${className}`}>
      {getSentimentIcon(sentiment)}
      {sentiment}
    </span>
  );
};

interface SentimentProbabilitiesProps {
  probabilities: {
    very_negative?: number | null;
    negative?: number | null;
    neutral?: number | null;
    positive?: number | null;
    very_positive?: number | null;
  };
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

export const SentimentProbabilities: React.FC<SentimentProbabilitiesProps> = ({ 
  probabilities, 
  className = '', 
  showLabels = true,
  compact = false 
}) => {
  const probs = {
    'Very Negative': probabilities.very_negative || 0,
    'Negative': probabilities.negative || 0,
    'Neutral': probabilities.neutral || 0,
    'Positive': probabilities.positive || 0,
    'Very Positive': probabilities.very_positive || 0,
  };

  // Check if we have any probabilities
  const hasData = Object.values(probs).some(p => p > 0);
  if (!hasData) return null;

  const getBarColor = (label: string) => {
    switch (label) {
      case 'Very Negative': return 'bg-red-500';
      case 'Negative': return 'bg-orange-500';
      case 'Neutral': return 'bg-gray-500';
      case 'Positive': return 'bg-green-500';
      case 'Very Positive': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <BarChart3 className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <div className="flex space-x-0.5">
          {Object.entries(probs).map(([label, prob]) => (
            <div
              key={label}
              className={`w-2 rounded-sm ${getBarColor(label)}`}
              style={{ height: `${Math.max(2, prob * 16)}px` }}
              title={`${label}: ${(prob * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 mb-2">
        <BarChart3 className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sentiment Probabilities
        </span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(probs)
          .sort(([,a], [,b]) => b - a) // Sort by probability descending
          .map(([label, prob]) => (
            <div key={label} className="flex items-center space-x-2">
              <div className="w-20 text-xs text-gray-600 dark:text-gray-400 truncate">
                {label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${getBarColor(label)}`}
                    style={{ width: `${prob * 100}%` }}
                  />
                </div>
              </div>
              {showLabels && (
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium min-w-0 flex-shrink-0 w-10 text-right">
                  {(prob * 100).toFixed(1)}%
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

interface SentimentSummaryProps {
  sentiment_label?: string | null;
  sentiment_vneg_prob?: number | null;
  sentiment_neg_prob?: number | null;
  sentiment_neu_prob?: number | null;
  sentiment_pos_prob?: number | null;
  sentiment_vpos_prob?: number | null;
  className?: string;
  compact?: boolean;
  showProbabilities?: boolean;
}

export const SentimentSummary: React.FC<SentimentSummaryProps> = ({
  sentiment_label,
  sentiment_vneg_prob,
  sentiment_neg_prob,
  sentiment_neu_prob,
  sentiment_pos_prob,
  sentiment_vpos_prob,
  className = '',
  compact = false,
  showProbabilities = true
}) => {
  // Don't render if no sentiment data is present
  if (!sentiment_label && 
      typeof sentiment_vneg_prob !== 'number' && 
      typeof sentiment_neg_prob !== 'number' && 
      typeof sentiment_neu_prob !== 'number' && 
      typeof sentiment_pos_prob !== 'number' && 
      typeof sentiment_vpos_prob !== 'number') {
    return null;
  }

  const probabilities = {
    very_negative: sentiment_vneg_prob,
    negative: sentiment_neg_prob,
    neutral: sentiment_neu_prob,
    positive: sentiment_pos_prob,
    very_positive: sentiment_vpos_prob,
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {sentiment_label && <SentimentTag sentiment={sentiment_label} />}
        {showProbabilities && (
          <SentimentProbabilities 
            probabilities={probabilities} 
            compact={true} 
            showLabels={false} 
          />
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {sentiment_label && (
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            5-Class Sentiment
          </div>
          <SentimentTag sentiment={sentiment_label} />
        </div>
      )}
      
      {showProbabilities && (
        <div>
          <SentimentProbabilities probabilities={probabilities} />
        </div>
      )}
    </div>
  );
};

export default SentimentSummary;