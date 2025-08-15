import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video, Calendar, Clock, User, Search, Filter, Eye, Play, ExternalLink } from 'lucide-react';
import { videosAPI, formatDate } from '../services/api';
import type { Video as VideoType } from '../types';
import VimeoEmbed from '../components/VimeoEmbed';

const VideosPage: React.FC = () => {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  
  const [filters, setFilters] = useState({
    search: '',
    source: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });
  
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadVideos();
  }, [currentPage, pageSize]);

  const loadVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const videoList = await videosAPI.getVideos(
        currentPage,
        pageSize,
        {
          search: filters.search || undefined,
          source: filters.source || undefined,
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          sort_by: filters.sortBy,
          sort_order: filters.sortOrder,
        }
      );

      setVideos(videoList);
      // Note: API doesn't return total count, so we estimate based on results
      setTotalPages(videoList.length === pageSize ? currentPage + 1 : currentPage);
    } catch (error) {
      console.error('Failed to load videos:', error);
      setError('Failed to load videos. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadVideos();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      source: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
    setCurrentPage(1);
    setTimeout(loadVideos, 100);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getSourceColor = (source?: string) => {
    if (!source) return 'bg-gray-100 text-gray-800';
    
    const colors: { [key: string]: string } = {
      'Fox News': 'bg-red-100 text-red-800',
      'CNN': 'bg-blue-100 text-blue-800',
      'NBC': 'bg-purple-100 text-purple-800',
      'ABC': 'bg-green-100 text-green-800',
      'CBS': 'bg-indigo-100 text-indigo-800',
      'Newsmax': 'bg-orange-100 text-orange-800',
      'White House': 'bg-blue-100 text-blue-800',
    };
    
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading && videos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-3">Video Library</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Browse and explore the complete collection of political video transcripts
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 mb-8">
          {/* Filter Toggle */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>

            <div className="flex items-center space-x-4">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          </div>

          {/* Filter Form */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              {/* Search and Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Search Videos</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="input pl-10"
                      placeholder="Search by title or description..."
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Source</label>
                  <input
                    type="text"
                    value={filters.source}
                    onChange={(e) => handleFilterChange('source', e.target.value)}
                    className="input"
                    placeholder="Filter by source..."
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">To Date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Sort Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Sort By</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="input"
                  >
                    <option value="date">Date</option>
                    <option value="title">Title</option>
                    <option value="source">Source</option>
                  </select>
                </div>

                <div>
                  <label className="label">Sort Order</label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                    className="input"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear all filters
                </button>
                <button
                  onClick={applyFilters}
                  className="btn btn-primary"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Videos Grid */}
        {videos.length > 0 ? (
          <div className="space-y-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 hover:shadow-2xl hover:border-blue-300/50 transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  {/* Video Thumbnail */}
                  <div className="flex-shrink-0 w-full lg:w-48">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <VimeoEmbed
                        vimeoVideoId={video.vimeo_video_id}
                        vimeoEmbedUrl={video.vimeo_embed_url}
                        title={video.title}
                        thumbnail={video.video_thumbnail_url}
                        width={192}
                        height={108}
                        showThumbnail={true}
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Video Header */}
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                        <Link
                          to={`/videos/${video.id}`}
                          className="hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 hover:bg-clip-text hover:text-transparent transition-all duration-200"
                        >
                          {video.title}
                        </Link>
                      </h3>
                    </div>

                    {/* Video Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                      {video.date && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>{formatDate(video.date)}</span>
                        </div>
                      )}
                      
                      {video.duration && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{formatDuration(video.duration)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <Video className="h-4 w-4 mr-1" />
                        <span>{video.filename}</span>
                      </div>
                    </div>

                    {/* Source and Channel */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {video.source && (
                        <span className={`badge ${getSourceColor(video.source)}`}>
                          {video.source}
                        </span>
                      )}
                      
                      {video.channel && video.channel !== video.source && (
                        <span className="badge badge-gray">
                          {video.channel}
                        </span>
                      )}
                    </div>

                    {/* Event Metadata */}
                    {(video.format || video.candidate || video.place || video.record_type) && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {video.format && (
                            <div>
                              <span className="text-gray-500">Format:</span>
                              <span className="ml-1 font-medium">{video.format}</span>
                            </div>
                          )}
                          {video.candidate && (
                            <div>
                              <span className="text-gray-500">Candidate:</span>
                              <span className="ml-1 font-medium">{video.candidate}</span>
                            </div>
                          )}
                          {video.place && (
                            <div>
                              <span className="text-gray-500">Place:</span>
                              <span className="ml-1 font-medium">{video.place}</span>
                            </div>
                          )}
                          {video.record_type && (
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <span className="ml-1 font-medium">{video.record_type}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {video.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {video.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center flex-wrap gap-3">
                      {video.video_url && (
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Watch Video
                        </a>
                      )}
                      
                      <Link
                        to={`/videos/${video.id}`}
                        className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Link>
                      
                      <Link
                        to={`/search?video_id=${video.id}`}
                        className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                      >
                        <Search className="h-4 w-4 mr-1" />
                        Search Segments
                      </Link>
                    </div>
                  </div>

                  {/* Video Info */}
                  <div className="flex-shrink-0 ml-6">
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-2">
                        Added {formatDate(video.created_at)}
                      </div>
                      
                      <div className="space-y-2">
                        {video.url && (
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                          >
                            <ExternalLink className="h-3 w-3 inline mr-1" />
                            Transcript Source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Video className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No videos found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.source || filters.dateFrom || filters.dateTo
                ? 'Try adjusting your filters'
                : 'No videos have been imported yet'
              }
            </p>
          </div>
        )}

        {/* Pagination */}
        {videos.length > 0 && (
          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-gray-500">
              Page {currentPage} {totalPages > currentPage && `of ${totalPages}+`}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={videos.length < pageSize}
                className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && videos.length > 0 && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideosPage;