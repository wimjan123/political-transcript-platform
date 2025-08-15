import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import AnalyticsPage from './pages/AnalyticsPage';
import VideosPage from './pages/VideosPage';
import VideoDetailPage from './pages/VideoDetailPage';
import DatabaseStatusPage from './pages/DatabaseStatusPage';
import IngestPage from './pages/IngestPage';
import NotFoundPage from './pages/NotFoundPage';
import PlaylistPage from './pages/PlaylistPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="videos/:videoId" element={<VideoDetailPage />} />
          <Route path="playlist" element={<PlaylistPage />} />
          <Route path="database-status" element={<DatabaseStatusPage />} />
          <Route path="ingest" element={<IngestPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
