import React, { useState, useEffect } from 'react';
import { Play, Upload, RefreshCw, Filter, Download, Eye, Clock, FileVideo } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';

interface VideoFile {
  id: number;
  title: string;
  filename: string;
  video_file_path?: string;
  srt_file_path?: string;
  video_format?: string;
  video_file_size?: number;
  video_duration_seconds?: number;
  video_resolution?: string;
  video_fps?: number;
  transcoding_status?: string;
  transcoded_file_path?: string;
  has_subtitles: boolean;
  playback_ready: boolean;
}

interface ImportStats {
  discovered: number;
  imported: number;
  skipped: number;
  errors: number;
}

const VideoLibrary: React.FC = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [transcoding, setTranscoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  
  // Filters
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadVideos();
  }, [formatFilter, statusFilter]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        limit: '100'
      });
      
      if (formatFilter) params.append('format_filter', formatFilter);
      if (statusFilter) params.append('status_filter', statusFilter);
      
      const response = await fetch(`/api/video-files/list?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load videos');
      }
      
      const data = await response.json();
      setVideos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const importVideos = async (forceReimport = false) => {
    try {
      setImporting(true);
      setError(null);
      
      const response = await fetch(`/api/video-files/import?force_reimport=${forceReimport}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to import videos');
      }
      
      const stats = await response.json();
      setImportStats(stats);
      
      // Reload video list
      await loadVideos();
      
      // Show import results
      if (stats.imported > 0 || stats.errors > 0) {
        const message = `Import completed: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`;
        alert(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import videos');
      console.error('Error importing videos:', err);
    } finally {
      setImporting(false);
    }
  };

  const transcodeVideos = async () => {
    try {
      setTranscoding(true);
      setError(null);
      
      const response = await fetch('/api/video-files/transcode', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to start transcoding');
      }
      
      alert('Transcoding started in background. Please check back later.');
      
      // Reload video list to see updated statuses
      setTimeout(() => loadVideos(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start transcoding');
      console.error('Error transcoding videos:', err);
    } finally {
      setTranscoding(false);
    }
  };

  const filteredVideos = videos.filter(video => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return video.title.toLowerCase().includes(query) || 
             video.filename.toLowerCase().includes(query);
    }
    return true;
  });

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'processing': return '⟳';
      case 'failed': return '✗';
      case 'pending': return '⏸';
      default: return '?';
    }
  };

  if (selectedVideo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-blue-600 hover:text-blue-800 mb-2"
              >
                ← Back to Video Library
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {selectedVideo.title}
              </h1>
            </div>
          </div>

          {/* Video Player */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <VideoPlayer
              videoId={selectedVideo.id}
              videoTitle={selectedVideo.title}
              hasSubtitles={selectedVideo.has_subtitles}
              className="w-full"
              height="500px"
            />
          </div>

          {/* Video Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Video Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Filename</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedVideo.filename}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Format</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedVideo.video_format?.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                <p className="text-gray-900 dark:text-gray-100">{formatDuration(selectedVideo.video_duration_seconds)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolution</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedVideo.video_resolution || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">File Size</p>
                <p className="text-gray-900 dark:text-gray-100">{formatFileSize(selectedVideo.video_file_size)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Transcoding Status</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedVideo.transcoding_status)}`}>
                  {getStatusIcon(selectedVideo.transcoding_status)} {selectedVideo.transcoding_status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Subtitles</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedVideo.has_subtitles ? 'Available' : 'Not available'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Video Library
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your AVI and MP4 video files with subtitle support
            </p>
          </div>
          
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <button
              onClick={() => importVideos(false)}
              disabled={importing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {importing ? 'Importing...' : 'Import Videos'}
            </button>
            
            <button
              onClick={transcodeVideos}
              disabled={transcoding}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {transcoding ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileVideo className="w-4 h-4 mr-2" />}
              {transcoding ? 'Processing...' : 'Transcode Videos'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All formats</option>
              <option value="mp4">MP4</option>
              <option value="avi">AVI</option>
              <option value="mkv">MKV</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            
            <button
              onClick={() => {
                setFormatFilter('');
                setStatusFilter('');
                setSearchQuery('');
              }}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Import Stats */}
        {importStats && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg mb-6">
            <p>Last import: {importStats.discovered} discovered, {importStats.imported} imported, {importStats.skipped} skipped, {importStats.errors} errors</p>
          </div>
        )}

        {/* Video Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <FileVideo className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">No videos found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {videos.length === 0 ? 'Import your first videos to get started' : 'No videos match your current filters'}
            </p>
            {videos.length === 0 && (
              <button
                onClick={() => importVideos(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Import Videos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVideos.map((video) => (
              <div key={video.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                {/* Thumbnail placeholder */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileVideo className="w-12 h-12 text-gray-400" />
                  </div>
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-50">
                    <button
                      onClick={() => setSelectedVideo(video)}
                      className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                      disabled={!video.playback_ready}
                    >
                      <Play className="w-6 h-6 ml-1" />
                    </button>
                  </div>
                  
                  {/* Status badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(video.transcoding_status)}`}>
                      {getStatusIcon(video.transcoding_status)}
                    </span>
                  </div>
                  
                  {/* Duration badge */}
                  {video.video_duration_seconds && (
                    <div className="absolute bottom-2 right-2">
                      <span className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.video_duration_seconds)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Video info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
                    {video.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
                    {video.filename}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{video.video_format?.toUpperCase()}</span>
                    <span>{video.video_resolution}</span>
                    <span>{formatFileSize(video.video_file_size)}</span>
                  </div>
                  
                  {video.has_subtitles && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        CC Subtitles
                      </span>
                    </div>
                  )}
                  
                  <div className="mt-3 flex justify-between">
                    <button
                      onClick={() => setSelectedVideo(video)}
                      disabled={!video.playback_ready}
                      className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {video.playback_ready ? 'Watch' : 'Processing'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoLibrary;