import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height }) => (
  <div 
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonCard: React.FC = () => (
  <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 dark:bg-gray-800/70 dark:border-gray-700">
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton width="120px" height="20px" />
        <Skeleton width="80px" height="16px" />
        <Skeleton width="60px" height="16px" />
      </div>
      
      {/* Title */}
      <Skeleton width="60%" height="16px" className="mb-2" />
      
      {/* Content */}
      <div className="space-y-2 mb-4">
        <Skeleton width="100%" height="16px" />
        <Skeleton width="90%" height="16px" />
        <Skeleton width="85%" height="16px" />
      </div>
      
      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        <Skeleton width="60px" height="16px" />
        <Skeleton width="80px" height="16px" />
        <Skeleton width="70px" height="16px" />
        <Skeleton width="90px" height="16px" />
      </div>
    </div>
  </div>
);

export const SearchResultsSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const AnalyticsChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
    <Skeleton width="40%" height="24px" className="mb-4" />
    <Skeleton width="100%" height="300px" />
  </div>
);

export const AnalyticsDashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <Skeleton width="30%" height="32px" className="mb-8" />
    
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <Skeleton width="60%" height="16px" className="mb-2" />
          <Skeleton width="40%" height="32px" />
        </div>
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AnalyticsChartSkeleton />
      <AnalyticsChartSkeleton />
    </div>
  </div>
);

export const VideoListSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 8 }, (_, i) => (
      <div key={i} className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <div className="animate-pulse flex space-x-4">
          <Skeleton className="w-32 h-20 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton width="80%" height="20px" />
            <Skeleton width="60%" height="16px" />
            <Skeleton width="40%" height="16px" />
            <div className="flex space-x-2 mt-3">
              <Skeleton width="60px" height="20px" />
              <Skeleton width="80px" height="20px" />
              <Skeleton width="70px" height="20px" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default Skeleton;