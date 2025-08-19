import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import SummarySearchPage from './pages/SummarySearchPage';
import VideosPage from './pages/VideosPage';
import VideoDetailPage from './pages/VideoDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import PlaylistPage from './pages/PlaylistPage';
import { AnalyticsDashboardSkeleton } from './components/SkeletonLoader';

// Lazy load heavy components that include charts and admin features
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const DatabaseStatusPage = React.lazy(() => import('./pages/DatabaseStatusPage'));
const IngestPage = React.lazy(() => import('./pages/IngestPage'));
const MeilisearchAdminPage = React.lazy(() => import('./pages/MeilisearchAdminPage'));
const AISettingsPage = React.lazy(() => import('./pages/AISettingsPage'));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="summaries" element={<SummarySearchPage />} />
            <Route 
              path="analytics" 
              element={
                <Suspense fallback={<div className="p-8"><AnalyticsDashboardSkeleton /></div>}>
                  <AnalyticsPage />
                </Suspense>
              } 
            />
            <Route path="videos" element={<VideosPage />} />
            <Route path="videos/:videoId" element={<VideoDetailPage />} />
            <Route path="playlist" element={<PlaylistPage />} />
            <Route 
              path="database-status" 
              element={
                <Suspense fallback={<div className="p-8">Loading...</div>}>
                  <DatabaseStatusPage />
                </Suspense>
              } 
            />
            <Route 
              path="meilisearch-admin" 
              element={
                <Suspense fallback={<div className="p-8">Loading...</div>}>
                  <MeilisearchAdminPage />
                </Suspense>
              } 
            />
            <Route 
              path="ai-settings" 
              element={
                <Suspense fallback={<div className="p-8">Loading...</div>}>
                  <AISettingsPage />
                </Suspense>
              } 
            />
            <Route 
              path="ingest" 
              element={
                <Suspense fallback={<div className="p-8">Loading...</div>}>
                  <IngestPage />
                </Suspense>
              } 
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </div>
      {/* Add React Query Devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

export default App;
