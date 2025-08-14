import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Video, Calendar, Clock, User, MessageSquare, TrendingUp, 
  BarChart3, Search, Play, ExternalLink, Shield, AlertTriangle, Eye
} from 'lucide-react';
import { videosAPI, formatDate, formatTimestamp, getSentimentColor, getSentimentLabel } from '../services/api';
import VimeoEmbed from '../components/VimeoEmbed';
import type { Video as VideoType, TranscriptSegment, VideoStats } from '../types';

const VideoDetailPage: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [urlParams] = useSearchParams();
  const [video, setVideo] = useState<VideoType | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentsPage, setSegmentsPage] = useState(1);
  const [segmentsPageSize] = useState(50);
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [hasMoreSegments, setHasMoreSegments] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [highlightSegmentId, setHighlightSegmentId] = useState<number | null>(null);
  const [autoScrolled, setAutoScrolled] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (videoId) {
      loadVideoData();
    }
  }, [videoId]);

  useEffect(() => {
    if (videoId) {
      loadSegments(true);
    }
  }, [speakerFilter]);

  const loadVideoData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [videoData, statsData] = await Promise.all([
        videosAPI.getVideo(parseInt(videoId!)),
        videosAPI.getVideoStats(parseInt(videoId!))
      ]);

      setVideo(videoData);
      setStats(statsData);
      loadSegments(true);
    } catch (error) {
      console.error('Failed to load video:', error);
      setError('Failed to load video details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSegments = async (reset = false) => {
    try {
      setLoadingSegments(true);
      const page = reset ? 1 : segmentsPage;
      
      const segmentsData = await videosAPI.getVideoSegments(
        parseInt(videoId!),
        page,
        segmentsPageSize,
        speakerFilter || undefined
      );

      if (reset) {
        setSegments(segmentsData);
        setSegmentsPage(1);
      } else {
        setSegments(prev => [...prev, ...segmentsData]);
      }

      setHasMoreSegments(segmentsData.length === segmentsPageSize);
      
      if (!reset) {
        setSegmentsPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load segments:', error);
      setError('Failed to load video segments.');
    } finally {
      setLoadingSegments(false);
    }
  };

  // After segments load, scroll to targeted segment/time once
  useEffect(() => {
    if (segments.length === 0 || autoScrolled) return;

    const tParam = urlParams.get('t');
    const segParam = urlParams.get('segment_id');
    let targetId: number | null = null;

    if (segParam) {
      const idNum = parseInt(segParam, 10);
      if (!Number.isNaN(idNum)) {
        targetId = idNum;
      }
    }

    if (targetId === null && tParam) {
      const tNum = parseInt(tParam, 10);
      if (!Number.isNaN(tNum)) {
        const candidate = segments.find(s => s.video_seconds >= tNum) || segments[0];
        if (candidate) targetId = candidate.id;
      }
    }

    if (targetId !== null) {
      setHighlightSegmentId(targetId);
      // Scroll into view after paint
      setTimeout(() => {
        const el = document.getElementById(`segment-${targetId}`);
        if (el && 'scrollIntoView' in el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setAutoScrolled(true);
    }
  }, [segments, autoScrolled, urlParams]);

  // If a time parameter is provided and the target is beyond current page,
  // prefetch more pages until the time is within range or no more pages.
  useEffect(() => {
    const tParam = urlParams.get('t');
    if (!tParam) return;
    const tNum = parseInt(tParam, 10);
    if (Number.isNaN(tNum) || segments.length === 0) return;

    const last = segments[segments.length - 1];
    if (last && last.video_seconds < tNum && hasMoreSegments && !loadingSegments) {
      loadMoreSegments();
    }
  }, [segments, urlParams, hasMoreSegments, loadingSegments]);

  const loadMoreSegments = () => {
    if (hasMoreSegments && !loadingSegments) {
      loadSegments();
    }
  };

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMoreSegments();
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [bottomRef, hasMoreSegments, loadingSegments]);

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

  const getModerationLevel = (segment: TranscriptSegment): { level: 'low' | 'medium' | 'high' | 'none', score: number, categories: string[] } => {
    const moderationScores = [
      segment.moderation_harassment,
      segment.moderation_hate,
      segment.moderation_self_harm,
      segment.moderation_sexual,
      segment.moderation_violence
    ].filter((score): score is number => typeof score === 'number');

    if (moderationScores.length === 0) {
      return { level: 'none', score: 0, categories: [] };
    }

    const maxScore = Math.max(...moderationScores);
    const categories = [];

    if (typeof segment.moderation_harassment === 'number' && segment.moderation_harassment > 0.3) categories.push('Harassment');
    if (typeof segment.moderation_hate === 'number' && segment.moderation_hate > 0.3) categories.push('Hate');
    if (typeof segment.moderation_self_harm === 'number' && segment.moderation_self_harm > 0.3) categories.push('Self-harm');
    if (typeof segment.moderation_sexual === 'number' && segment.moderation_sexual > 0.3) categories.push('Sexual');
    if (typeof segment.moderation_violence === 'number' && segment.moderation_violence > 0.3) categories.push('Violence');

    if (maxScore >= 0.7) return { level: 'high', score: maxScore, categories };
    if (maxScore >= 0.4) return { level: 'medium', score: maxScore, categories };
    if (maxScore >= 0.1) return { level: 'low', score: maxScore, categories };
    return { level: 'none', score: maxScore, categories };
  };

  const getReadabilityLabel = (score?: number | null) => {
    if (typeof score !== 'number') return 'N/A';
    
    if (score <= 6) return 'Elementary';
    if (score <= 8) return 'Middle School';
    if (score <= 12) return 'High School';
    if (score <= 16) return 'College';
    return 'Graduate';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video details...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Video not found'}</p>
          <Link to="/videos" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/videos"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Link>
        </div>

        {/* Video Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Vimeo Video Embed */}
              <div className="mb-6">
                <VimeoEmbed
                  vimeoVideoId={video.vimeo_video_id}
                  vimeoEmbedUrl={video.vimeo_embed_url}
                  title={video.title}
                  thumbnail={video.video_thumbnail_url}
                  width="100%"
                  height={400}
                  showThumbnail={false}
                />
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{video.title}</h1>
              
              {/* Video Metadata */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-4">
                {video.date && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{formatDate(video.date)}</span>
                  </div>
                )}
                
                {video.duration && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{formatDuration(video.duration)}</span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <Video className="h-4 w-4 mr-2" />
                  <span>{video.filename}</span>
                </div>
              </div>

              {/* Source and Channel */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
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

              {/* Description */}
              {video.description && (
                <p className="text-gray-700 mb-6 leading-relaxed">
                  {video.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-4">
                <Link
                  to={`/search?video_id=${video.id}`}
                  className="btn btn-primary"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search This Video
                </Link>
                
                {video.video_url && (
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary mr-4"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Watch Video
                  </a>
                )}
                
                {video.url && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Transcript Source
                  </a>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 ml-8">
              <div className="text-right text-sm text-gray-500">
                <p>Added {formatDate(video.created_at)}</p>
                <p className="mt-1">ID: {video.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Segments
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_segments.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Words
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_words.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Avg Sentiment
                      </dt>
                      <dd className={`text-lg font-medium ${getSentimentColor(stats.avg_sentiment)}`}>
                        {getSentimentLabel(stats.avg_sentiment)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Readability Grade
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.avg_readability ? stats.avg_readability.toFixed(1) : 'N/A'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Speaker Statistics */}
        {stats && stats.speaker_stats.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Speaker Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Speaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Words
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.speaker_stats.map((speakerStat) => (
                    <tr key={speakerStat.speaker}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {speakerStat.speaker}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {speakerStat.segment_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {speakerStat.total_words.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          speakerStat.avg_sentiment > 0 
                            ? 'bg-green-100 text-green-800' 
                            : speakerStat.avg_sentiment < 0 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {speakerStat.avg_sentiment.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => setSpeakerFilter(speakerStat.speaker)}
                          className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                        >
                          Filter segments
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transcript Segments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900">Transcript Segments</h2>
            
            {/* Speaker Filter */}
            <div className="flex items-center space-x-4">
              {speakerFilter && (
                <span className="text-sm text-gray-500">
                  Filtered by: <strong>{speakerFilter}</strong>
                </span>
              )}
              
              <input
                type="text"
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                placeholder="Filter by speaker..."
                className="text-sm border border-gray-300 rounded-md px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              
              {speakerFilter && (
                <button
                  onClick={() => setSpeakerFilter('')}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Segments List */}
          <div className="space-y-4">
            {segments.map((segment) => (
              <div
                key={segment.id}
                id={`segment-${segment.id}`}
                className={`border rounded-lg p-4 transition-colors ${
                  highlightSegmentId === segment.id
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Segment Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{segment.speaker_name}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimestamp(segment.video_seconds)}</span>
                      {segment.timestamp_start && segment.timestamp_end && (
                        <span>({segment.timestamp_start}-{segment.timestamp_end})</span>
                      )}
                    </div>
                  </div>

                  <button className="text-primary-600 hover:text-primary-700 transition-colors">
                    <Play className="h-4 w-4" />
                  </button>
                </div>

                {/* Transcript Text */}
                <div className="text-gray-900 mb-3 leading-relaxed">
                  {segment.transcript_text}
                </div>

                {/* Enhanced Segment Metadata */}
                <div className="space-y-3">
                  {/* Basic Info Row */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{segment.word_count} words</span>
                    
                    {typeof segment.sentiment_loughran_score === 'number' && (
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className={getSentimentColor(segment.sentiment_loughran_score)}>
                          {getSentimentLabel(segment.sentiment_loughran_score)} ({segment.sentiment_loughran_score.toFixed(3)})
                        </span>
                      </div>
                    )}
                    
                    {typeof segment.flesch_kincaid_grade === 'number' && (
                      <div className="flex items-center space-x-1">
                        <BarChart3 className="h-4 w-4" />
                        <span>{getReadabilityLabel(segment.flesch_kincaid_grade)} (Grade {segment.flesch_kincaid_grade.toFixed(1)})</span>
                      </div>
                    )}
                  </div>

                  {/* Content Moderation Warning */}
                  {(() => {
                    const moderation = getModerationLevel(segment);
                    if (moderation.level === 'none') return null;
                    
                    const levelColors = {
                      low: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                      medium: 'bg-orange-50 border-orange-200 text-orange-800',
                      high: 'bg-red-50 border-red-200 text-red-800'
                    };
                    
                    return (
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm ${levelColors[moderation.level]}`}>
                        <Shield className="h-4 w-4" />
                        <span>
                          Content Advisory ({moderation.level}): {moderation.categories.join(', ')} 
                          {moderation.score > 0 && ` (${(moderation.score * 100).toFixed(1)}%)`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Detailed Analytics (Expandable) */}
                  {(typeof segment.sentiment_harvard_score === 'number' || 
                    typeof segment.sentiment_vader_score === 'number' ||
                    typeof segment.flesch_reading_ease === 'number') && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700 select-none">
                        <Eye className="h-4 w-4 inline mr-2" />
                        View detailed analytics
                      </summary>
                      <div className="mt-3 space-y-2 pl-6 border-l border-gray-200">
                        {/* Additional Sentiment Scores */}
                        {typeof segment.sentiment_harvard_score === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Harvard IV Sentiment:</span>
                            <span className={getSentimentColor(segment.sentiment_harvard_score)}>
                              {segment.sentiment_harvard_score.toFixed(3)} ({segment.sentiment_harvard_label})
                            </span>
                          </div>
                        )}
                        
                        {typeof segment.sentiment_vader_score === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">VADER Sentiment:</span>
                            <span className={getSentimentColor(segment.sentiment_vader_score)}>
                              {segment.sentiment_vader_score.toFixed(3)} ({segment.sentiment_vader_label})
                            </span>
                          </div>
                        )}
                        
                        {/* Readability Metrics */}
                        {typeof segment.flesch_reading_ease === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Reading Ease:</span>
                            <span>{segment.flesch_reading_ease.toFixed(1)}</span>
                          </div>
                        )}
                        
                        {typeof segment.gunning_fog_index === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Gunning Fog:</span>
                            <span>{segment.gunning_fog_index.toFixed(1)}</span>
                          </div>
                        )}
                        
                        {typeof segment.coleman_liau_index === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Coleman-Liau:</span>
                            <span>{segment.coleman_liau_index.toFixed(1)}</span>
                          </div>
                        )}
                        
                        {/* Moderation Detailed Scores */}
                        {[
                          { key: 'moderation_harassment', label: 'Harassment' },
                          { key: 'moderation_hate', label: 'Hate' },
                          { key: 'moderation_self_harm', label: 'Self-harm' },
                          { key: 'moderation_sexual', label: 'Sexual' },
                          { key: 'moderation_violence', label: 'Violence' }
                        ].map(({ key, label }) => {
                          const score = segment[key as keyof TranscriptSegment] as number;
                          if (typeof score !== 'number') return null;
                          return (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-gray-600">{label}:</span>
                              <span className={score > 0.5 ? 'text-red-600 font-medium' : score > 0.3 ? 'text-orange-600' : ''}>
                                {(score * 100).toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                        
                        {/* Topic Information */}
                        {segment.segment_topics && segment.segment_topics.length > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            <span className="text-gray-600 block mb-2">Topics:</span>
                            <div className="flex flex-wrap gap-1">
                              {segment.segment_topics.map((topicData, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {topicData.topic.name} ({(topicData.score * 100).toFixed(0)}%)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Load More Button */}
          {hasMoreSegments && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreSegments}
                disabled={loadingSegments}
                className="btn btn-outline"
              >
                {loadingSegments ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Load More Segments'
                )}
              </button>
            </div>
          )}

          {/* No Segments Message */}
          {segments.length === 0 && !loadingSegments && (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No segments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {speakerFilter 
                  ? `No segments found for speaker "${speakerFilter}"`
                  : 'This video has no transcript segments'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoDetailPage;
