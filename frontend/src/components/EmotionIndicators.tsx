import React from 'react';
import { Heart, Thermometer, Zap } from 'lucide-react';
import { getEmotionBgColor, getHeatColor, getHeatLabel } from '../services/api';

interface EmotionTagProps {
  emotion: string | null | undefined;
  className?: string;
}

export const EmotionTag: React.FC<EmotionTagProps> = ({ emotion, className = '' }) => {
  if (!emotion) return null;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEmotionBgColor(emotion)} ${className}`}>
      <Heart className="h-3 w-3 mr-1" />
      {emotion}
    </span>
  );
};

interface EmotionIntensityBarProps {
  intensity: number | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export const EmotionIntensityBar: React.FC<EmotionIntensityBarProps> = ({ 
  intensity, 
  className = '', 
  showLabel = true 
}) => {
  if (typeof intensity !== 'number') return null;

  const percentage = Math.min(100, Math.max(0, intensity));
  
  // Color based on intensity level
  const getIntensityColor = (value: number) => {
    if (value >= 80) return 'bg-red-500';
    if (value >= 60) return 'bg-orange-500';
    if (value >= 40) return 'bg-yellow-500';
    if (value >= 20) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Zap className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getIntensityColor(percentage)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 dark:text-gray-300 font-medium min-w-0 flex-shrink-0">
          {intensity}%
        </span>
      )}
    </div>
  );
};

interface HeatMeterProps {
  score: number | null | undefined;
  className?: string;
  showLabel?: boolean;
  showComponents?: boolean;
  components?: { [key: string]: number } | null;
}

export const HeatMeter: React.FC<HeatMeterProps> = ({ 
  score, 
  className = '', 
  showLabel = true,
  showComponents = false,
  components
}) => {
  if (typeof score !== 'number') return null;

  const percentage = Math.min(100, Math.max(0, score * 100));
  
  // Heat meter uses red gradient
  const getHeatBarColor = (value: number) => {
    if (value >= 80) return 'bg-gradient-to-r from-red-600 to-red-700';
    if (value >= 60) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (value >= 40) return 'bg-gradient-to-r from-orange-500 to-red-500';
    if (value >= 20) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-green-500 to-yellow-500';
  };

  const formatComponentScore = (value: number): string => {
    return (value * 100).toFixed(0);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Thermometer className={`h-4 w-4 flex-shrink-0 ${getHeatColor(score)}`} />
        <div className="flex-1 min-w-0">
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getHeatBarColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        {showLabel && (
          <span className={`text-xs font-medium min-w-0 flex-shrink-0 ${getHeatColor(score)}`}>
            {getHeatLabel(score)} ({(score * 100).toFixed(1)}%)
          </span>
        )}
      </div>
      
      {/* Heat Components Breakdown */}
      {showComponents && components && Object.keys(components).length > 0 && (
        <div className="ml-6 space-y-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Components:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(components)
              .sort(([,a], [,b]) => b - a) // Sort by score descending
              .map(([component, value]) => (
                <span 
                  key={component}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                >
                  {component}: {formatComponentScore(value)}%
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface EmotionSummaryProps {
  emotion: string | null | undefined;
  intensity: number | null | undefined;
  heatScore: number | null | undefined;
  heatComponents?: { [key: string]: number } | null;
  className?: string;
  compact?: boolean;
}

export const EmotionSummary: React.FC<EmotionSummaryProps> = ({
  emotion,
  intensity,
  heatScore,
  heatComponents,
  className = '',
  compact = false
}) => {
  // Don't render if no emotion data is present
  if (!emotion && typeof intensity !== 'number' && typeof heatScore !== 'number') {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {emotion && <EmotionTag emotion={emotion} />}
        {typeof intensity === 'number' && (
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300">{intensity}%</span>
          </div>
        )}
        {typeof heatScore === 'number' && (
          <div className="flex items-center space-x-1">
            <Thermometer className={`h-3 w-3 ${getHeatColor(heatScore)}`} />
            <span className={`text-xs ${getHeatColor(heatScore)}`}>
              {(heatScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {emotion && (
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emotion</div>
          <EmotionTag emotion={emotion} />
        </div>
      )}
      
      {typeof intensity === 'number' && (
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intensity</div>
          <EmotionIntensityBar intensity={intensity} />
        </div>
      )}
      
      {typeof heatScore === 'number' && (
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Heat Score</div>
          <HeatMeter 
            score={heatScore} 
            showComponents={!!heatComponents}
            components={heatComponents}
          />
        </div>
      )}
    </div>
  );
};

export default EmotionSummary;