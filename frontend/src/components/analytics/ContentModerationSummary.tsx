import React from 'react';
import { Shield, AlertTriangle, AlertCircle, Eye, Heart, Zap } from 'lucide-react';

interface ModerationDataPoint {
  category: string;
  avg_score?: number;
  count?: number;
}

interface ContentModerationSummaryProps {
  data: ModerationDataPoint[];
  isLoading?: boolean;
}

const ContentModerationSummary: React.FC<ContentModerationSummaryProps> = ({ 
  data, 
  isLoading = false 
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'harassment':
        return <AlertTriangle className="h-5 w-5" />;
      case 'hate':
        return <AlertCircle className="h-5 w-5" />;
      case 'self_harm':
        return <Heart className="h-5 w-5" />;
      case 'sexual':
        return <Eye className="h-5 w-5" />;
      case 'violence':
        return <Zap className="h-5 w-5" />;
      case 'high_risk_segments':
        return <Shield className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: string, score?: number) => {
    if (category === 'high_risk_segments') {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    
    if (!score) return 'text-gray-600 bg-gray-50 border-gray-200';
    
    if (score > 0.7) return 'text-red-600 bg-red-50 border-red-200';
    if (score > 0.5) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score > 0.3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getRiskLevel = (score?: number) => {
    if (!score) return 'Unknown';
    if (score > 0.7) return 'High';
    if (score > 0.5) return 'Medium';
    if (score > 0.3) return 'Low';
    return 'Very Low';
  };

  const formatCategoryName = (category: string) => {
    switch (category) {
      case 'self_harm':
        return 'Self Harm';
      case 'high_risk_segments':
        return 'High Risk Segments';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  const formatScore = (score?: number) => {
    if (score === undefined) return 'N/A';
    return (score * 100).toFixed(1) + '%';
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Shield className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Content Moderation</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Shield className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Content Moderation</h3>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No moderation data available</p>
        </div>
      </div>
    );
  }

  // Separate high risk count from category scores
  const highRiskData = data.find(item => item.category === 'high_risk_segments');
  const categoryData = data.filter(item => item.category !== 'high_risk_segments');

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Shield className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Content Moderation</h3>
        </div>
        <div className="text-sm text-gray-500">
          Risk Assessment
        </div>
      </div>
      
      {/* High Risk Segments Alert */}
      {highRiskData && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h4 className="font-medium text-red-900">High Risk Content</h4>
              <p className="text-sm text-red-700">
                {highRiskData.count || 0} segments flagged as high risk (&gt;50% confidence)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryData.map((item) => (
          <div
            key={item.category}
            className={`p-4 rounded-lg border ${getCategoryColor(item.category, item.avg_score)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className={getCategoryColor(item.category, item.avg_score).split(' ')[0]}>
                  {getCategoryIcon(item.category)}
                </span>
                <span className="ml-2 font-medium">
                  {formatCategoryName(item.category)}
                </span>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-white border">
                {getRiskLevel(item.avg_score)}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Average Score:</span>
                <span className="font-medium">{formatScore(item.avg_score)}</span>
              </div>
              
              {/* Score bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    (item.avg_score || 0) > 0.7 ? 'bg-red-500' :
                    (item.avg_score || 0) > 0.5 ? 'bg-orange-500' :
                    (item.avg_score || 0) > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(item.avg_score || 0) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Assessment */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Overall Assessment</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Categories Monitored</p>
            <p className="font-medium text-gray-900">{categoryData.length}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Avg Risk Score</p>
            <p className="font-medium text-gray-900">
              {categoryData.length > 0 
                ? formatScore(categoryData.reduce((sum, item) => sum + (item.avg_score || 0), 0) / categoryData.length)
                : 'N/A'
              }
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">High Risk Segments</p>
            <p className="font-medium text-red-600">{highRiskData?.count || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Status</p>
            <p className={`font-medium ${
              (highRiskData?.count || 0) > 10 ? 'text-red-600' :
              (highRiskData?.count || 0) > 5 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {(highRiskData?.count || 0) > 10 ? 'Attention Needed' :
               (highRiskData?.count || 0) > 5 ? 'Monitor' : 'Good'}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          <strong>Risk Levels:</strong> Very Low (&lt;30%) • Low (30-50%) • Medium (50-70%) • High (&gt;70%)
        </p>
      </div>
    </div>
  );
};

export default ContentModerationSummary;