import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Video, Calendar, Clock, User, MessageSquare, TrendingUp, 
  BarChart3, Search, Play, ExternalLink, Shield, AlertTriangle, Eye, Plus, Sparkles
} from 'lucide-react';
import { playlist } from '../services/playlist';
import { videosAPI, formatDate, formatTimestamp, formatTimestampRange, getSentimentColor, getSentimentLabel, downloadFile } from '../services/api';
import VimeoEmbed from '../components/VimeoEmbed';
const EnhancedTranscriptSummarizer = React.lazy(() => import('../components/EnhancedTranscriptSummarizer'));
const SimilarSegmentsModal = React.lazy(() => import('../components/SimilarSegmentsModal'));
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
  const [keywordFilter, setKeywordFilter] = useState('');
  const [hasMoreSegments, setHasMoreSegments] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [highlightSegmentId, setHighlightSegmentId] = useState<number | null>(null);
  const [autoScrolled, setAutoScrolled] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [similarModalOpen, setSimilarModalOpen] = useState(false);
  const [selectedSegmentForSimilar, setSelectedSegmentForSimilar] = useState<TranscriptSegment | null>(null);
  const [showSummarizer, setShowSummarizer] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const vimeoTimeFragment = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [] as string[];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join('');
  };

  const buildWatchUrlAt = (seconds: number) => {
    if (!video) return undefined;
    const base = video.vimeo_video_id
      ? `https://vimeo.com/${video.vimeo_video_id}`
      : (video.vimeo_embed_url || video.video_url);
    if (!base) return undefined;
    const frag = vimeoTimeFragment(seconds);
    // Prefer #t= for Vimeo; for non-Vimeo links, just return base
    if (base.includes('vimeo.com')) return `${base}#t=${frag}`;
    return base;
  };

  useEffect(() => {
    if (videoId) {
      loadVideoData();
    }
  }, [videoId]);

  useEffect(() => {
    if (videoId) {
      loadSegments(true);
    }
  }, [speakerFilter, keywordFilter]);

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
        speakerFilter || undefined,
        keywordFilter || undefined
      );

      if (reset) {
        setSegments(segmentsData);
        setSegmentsPage(1);
        setSelectedSegmentIds(new Set());
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

  const toggleSelectSegment = (id: number) => {
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedSegmentIds(prev => {
      const next = new Set(prev);
      segments.forEach(s => next.add(s.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedSegmentIds(new Set());

  const handleFindSimilarSegments = (segment: TranscriptSegment) => {
    setSelectedSegmentForSimilar(segment);
    setSimilarModalOpen(true);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  };

  const exportSelectedTxt = () => {
    if (!video) return;
    const selected = segments.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    const lines = selected.map(s => {
      const ts = formatTimestamp(s.video_seconds);
      const speaker = s.speaker_name || 'Unknown';
      return `[${ts}] ${speaker}: ${s.transcript_text}`;
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const safeTitle = (video.title || `video-${video.id}`).replace(/[^a-z0-9-_]+/gi, '_');
    downloadFile(blob as unknown as Blob, `${safeTitle}_segments.txt`);
  };

  const exportSelectedVimeoLinks = () => {
    if (!video) return;
    const selected = segments.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    const lines = selected.map(s => {
      const start = formatTimestamp(s.video_seconds);
      const end = s.duration_seconds ? formatTimestamp(s.video_seconds + s.duration_seconds) : undefined;
      const url = buildWatchUrlAt(s.video_seconds) || '';
      const range = end ? `[${start} - ${end}]` : `[${start}]`;
      return `${range} ${s.speaker_name || 'Unknown'}: ${s.transcript_text}\n${url}`;
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const safeTitle = (video.title || `video-${video.id}`).replace(/[^a-z0-9-_]+/gi, '_');
    downloadFile(blob as unknown as Blob, `${safeTitle}_vimeo_links.txt`);
  };

  const exportSelectedClips = async () => {
    if (!video) return;
    const selected = segments.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    // Build items with durations; fall back to next segment start or 15s
    const items = selected.map((s, idx) => {
      const start = Math.max(0, s.video_seconds || 0);
      let duration = s.duration_seconds || 0;
      if (!duration) {
        const i = segments.findIndex(ss => ss.id === s.id);
        const next = i >= 0 ? segments[i + 1] : undefined;
        if (next && typeof next.video_seconds === 'number') {
          duration = Math.max(1, (next.video_seconds as number) - start);
        } else {
          duration = 15; // sensible default
        }
      }
      const label = `${formatTimestamp(start)}_${(s.speaker_name || 'segment').replace(/[^a-z0-9-_]+/gi, '_')}`;
      return { start_seconds: start, duration_seconds: duration, label };
    });
    try {
      const blob = await videosAPI.downloadClipsZip(video.id, items);
      const safeTitle = (video.title || `video-${video.id}`).replace(/[^a-z0-9-_]+/gi, '_');
      downloadFile(blob, `${safeTitle}_clips.zip`);
    } catch (e) {
      console.error('Failed to export clips', e);
      alert('Failed to generate clips. Ensure the server has ffmpeg and a downloadable video source.');
    }
  };

  const addSelectedSegmentsToPlaylist = () => {
    const selected = segments.filter(s => selectedSegmentIds.has(s.id));
    if (selected.length === 0) return;
    playlist.addSegments(selected as any);
  };

  const addSelectedClipsToPlaylist = () => {
    const selected = segments.filter(s => selectedSegmentIds.has(s.id));
    if (!video || selected.length === 0) return;
    selected.forEach((s) => {
      const start = Math.max(0, s.video_seconds || 0);
      let duration = s.duration_seconds || 0;
      if (!duration) {
        const i = segments.findIndex(ss => ss.id === s.id);
        const next = i >= 0 ? segments[i + 1] : undefined;
        if (next && typeof next.video_seconds === 'number') {
          duration = Math.max(1, (next.video_seconds as number) - start);
        } else {
          duration = 15;
        }
      }
      playlist.addClip(video, start, duration, `${s.speaker_name || 'segment'}`);
    });
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video details...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 mb-4 dark:text-red-400">{error || 'Video not found'}</p>
          <Link to="/videos" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/videos"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Link>
        </div>

        {/* Video Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mb-8 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-6 lg:space-y-0">
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
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">{video.title}</h1>
              
              {/* Video Metadata */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-4 dark:text-gray-300">
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

              {/* Event Metadata */}
              {(video.format || video.candidate || video.place || video.record_type) && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 dark:bg-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 dark:text-gray-100">Event Metadata</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {video.format && (
                      <div>
                      <span className="text-gray-500 dark:text-gray-400">Format:</span>
                        <span className="ml-2 font-medium dark:text-gray-200">{video.format}</span>
                      </div>
                    )}
                    {video.candidate && (
                      <div>
                      <span className="text-gray-500 dark:text-gray-400">Candidate:</span>
                        <span className="ml-2 font-medium dark:text-gray-200">{video.candidate}</span>
                      </div>
                    )}
                    {video.place && (
                      <div>
                      <span className="text-gray-500 dark:text-gray-400">Place:</span>
                        <span className="ml-2 font-medium dark:text-gray-200">{video.place}</span>
                      </div>
                    )}
                    {video.record_type && (
                      <div>
                      <span className="text-gray-500 dark:text-gray-400">Record Type:</span>
                        <span className="ml-2 font-medium dark:text-gray-200">{video.record_type}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <p className="text-gray-700 mb-6 leading-relaxed dark:text-gray-300">
                  {video.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Link
                  to={`/search?video_id=${video.id}`}
                  className="btn btn-primary"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search This Video
                </Link>

                <button
                  onClick={() => setShowSummarizer(!showSummarizer)}
                  className="btn btn-outline"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {showSummarizer ? 'Hide Summarizer' : 'Summarize Transcript'}
                </button>

                {(() => {
                  const vimeoWatchUrl = video.vimeo_video_id
                    ? `https://vimeo.com/${video.vimeo_video_id}`
                    : (video.vimeo_embed_url || video.video_url);
                  if (!vimeoWatchUrl) return null;
                  return (
                    <a
                      href={vimeoWatchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Watch Video
                    </a>
                  );
                })()}
                
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

            <div className="flex-shrink-0 lg:ml-8">
              <div className="text-left lg:text-right text-sm text-gray-500 dark:text-gray-400">
                <p>Added {formatDate(video.created_at)}</p>
                <p className="mt-1">ID: {video.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                        Total Segments
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {stats.total_segments.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

        <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                        Total Words
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {stats.total_words.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

        <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
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

        <div className="bg-white overflow-hidden shadow rounded-lg dark:bg-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                        Readability Grade
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {stats.avg_readability ? stats.avg_readability.toFixed(1) : 'N/A'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Transcript Summarizer */}
        {showSummarizer && video && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              AI Transcript Summarization
            </h2>
            <React.Suspense fallback={<div className="text-sm text-gray-500">Loading summarizer…</div>}>
              <EnhancedTranscriptSummarizer videoId={parseInt(videoId!)} />
            </React.Suspense>
          </div>
        )}

        {/* Speaker Statistics */}
        {stats && stats.speaker_stats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Speaker Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Speaker
                    </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Segments
                    </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Words
                    </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Avg Sentiment
                    </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {stats.speaker_stats.map((speakerStat) => (
                    <tr key={speakerStat.speaker}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {speakerStat.speaker}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {speakerStat.segment_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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

        {/* Session Announcements - Only for Tweede Kamer videos */}
        {video?.dataset === 'tweede_kamer' && segments.some(s => s.segment_type === 'announcement') && (
          <div className="bg-amber-50 rounded-lg shadow-sm border border-amber-200 p-4 sm:p-6 mb-8 dark:bg-amber-900/20 dark:border-amber-800">
            <h2 className="text-lg font-medium text-amber-800 mb-4 dark:text-amber-300">
              Sessie-aankondigingen
              <span className="ml-2 text-sm font-normal">
                ({segments.filter(s => s.segment_type === 'announcement').length} items)
              </span>
            </h2>
            <div className="space-y-3">
              {segments.filter(s => s.segment_type === 'announcement').map((announcement) => {
                // Categorize announcement type for better visual distinction
                const getAnnouncementCategory = (text: string) => {
                  if (/aanwezig zijn|en (mevrouw|de heer)|alsmede/i.test(text)) return 'attendance';
                  if (/vergadering wordt|aanvang|sluiting/i.test(text)) return 'session';
                  if (/verslag van|kamerstuk|tk \d+/i.test(text)) return 'document';
                  if (/voorzitter|griffier/i.test(text)) return 'role';
                  if (/stemming|procedurepunten/i.test(text)) return 'procedure';
                  return 'general';
                };
                
                const category = getAnnouncementCategory(announcement.transcript_text);
                const categoryStyles = {
                  attendance: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
                  session: 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300',
                  document: 'border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
                  role: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
                  procedure: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
                  general: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                };
                
                const categoryLabels = {
                  attendance: 'Aanwezigheid',
                  session: 'Sessie status',
                  document: 'Document',
                  role: 'Functie',
                  procedure: 'Procedure',
                  general: 'Algemeen'
                };
                
                return (
                  <div
                    key={announcement.id}
                    className={`border-l-4 pl-4 py-3 rounded-r-md text-sm ${categoryStyles[category]}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-opacity-50 bg-white font-medium">
                          {categoryLabels[category]}
                        </span>
                        <span className="text-xs opacity-75">
                          {announcement.video_seconds ? formatTimestamp(announcement.video_seconds) : ''}
                          {announcement.timestamp_start && announcement.timestamp_end && (
                            <span className="ml-2">({formatTimestampRange(announcement.timestamp_start, announcement.timestamp_end)})</span>
                          )}
                        </span>
                      </div>
                      {announcement.word_count && (
                        <span className="text-xs opacity-75">
                          {announcement.word_count} woorden
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed">{announcement.transcript_text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcript Segments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Transcript Segments
              {video?.dataset === 'tweede_kamer' && (
                <span className="ml-2 text-sm text-gray-500">(Gesproken content)</span>
              )}
            </h2>
            
            {/* Selection + Speaker Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                <button
                  onClick={() => {
                    setSelectionMode((prev) => {
                      const next = !prev;
                      if (!next) clearSelection();
                      return next;
                    });
                  }}
                  className={`btn ${selectionMode ? 'btn-outline' : 'btn-primary'}`}
                >
                  {selectionMode ? 'Disable Selection' : 'Select Segments'}
                </button>

                {selectionMode && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={exportSelectedTxt}
                      disabled={selectedSegmentIds.size === 0}
                      className={`btn btn-primary text-sm ${selectedSegmentIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Export (.txt)
                    </button>
                    <button
                      onClick={exportSelectedClips}
                      disabled={selectedSegmentIds.size === 0}
                      className={`btn btn-primary text-sm ${selectedSegmentIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Export (clips)
                    </button>
                    <button
                      onClick={exportSelectedVimeoLinks}
                      disabled={selectedSegmentIds.size === 0}
                      className={`btn btn-outline text-sm ${selectedSegmentIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Export (links)
                    </button>
                    <button onClick={selectAllVisible} className="btn btn-outline text-sm">Select Visible</button>
                    {selectedSegmentIds.size > 0 && (
                      <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700">Clear ({selectedSegmentIds.size})</button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={speakerFilter}
                  onChange={(e) => setSpeakerFilter(e.target.value)}
                  placeholder="Filter by speaker..."
                  className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  placeholder="Filter by keyword..."
                  className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
                
                {(speakerFilter || keywordFilter) && (
                  <button
                    onClick={() => { setSpeakerFilter(''); setKeywordFilter(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors self-start"
                  >
                    Clear
                  </button>
                )}
              </div>

              {(speakerFilter || keywordFilter) && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Filtered by: {speakerFilter && (<><strong>{speakerFilter}</strong> (speaker)</>)} {speakerFilter && keywordFilter && '•'} {keywordFilter && (<><strong>{keywordFilter}</strong> (keyword)</>)}
                </span>
              )}

              {selectionMode && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={addSelectedSegmentsToPlaylist} className="btn btn-outline text-sm">Add Selected (segments)</button>
                  <button onClick={addSelectedClipsToPlaylist} className="btn btn-outline text-sm">Add Selected (clips)</button>
                </div>
              )}
            </div>
          </div>

          {/* Segments List */}
          <div className="space-y-4">
            {segments.filter(s => s.segment_type !== 'announcement').map((segment) => (
              <div
                key={segment.id}
                id={`segment-${segment.id}`}
                className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                  highlightSegmentId === segment.id
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Segment Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedSegmentIds.has(segment.id)}
                        onChange={() => toggleSelectSegment(segment.id)}
                        className="h-4 w-4"
                        aria-label="Select segment"
                      />
                    )}
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{segment.speaker_name}</span>
                        {segment.speaker_party && video?.dataset === 'tweede_kamer' && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                            {segment.speaker_party}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimestamp(segment.video_seconds)}</span>
                      {segment.timestamp_start && segment.timestamp_end && (
                        <span>({formatTimestampRange(segment.timestamp_start, segment.timestamp_end)})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {(() => {
                      const href = buildWatchUrlAt(segment.video_seconds);
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary-600 hover:text-primary-700 transition-colors"
                          title="Open video at timestamp"
                        >
                          <Play className="h-4 w-4" />
                        </a>
                      ) : (
                        <button className="p-2 text-gray-400 cursor-not-allowed" disabled>
                          <Play className="h-4 w-4" />
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => playlist.addSegment(segment as any)}
                      className="p-2 text-primary-600 hover:text-primary-700 transition-colors"
                      title="Add segment to playlist"
                      aria-label="Add segment to playlist"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleFindSimilarSegments(segment)}
                      className="p-2 text-purple-600 hover:text-purple-700 transition-colors"
                      title="Find similar segments"
                      aria-label="Find similar segments"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Transcript Text */}
                <div className="text-gray-900 dark:text-gray-100 mb-3 leading-relaxed">
                  {keywordFilter ? highlightText(segment.transcript_text, keywordFilter) : segment.transcript_text}
                </div>

                {/* Enhanced Segment Metadata */}
                <div className="space-y-3">
                  {/* Basic Info Row */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                    
                    {typeof segment.stresslens_score === 'number' && (
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4" />
                        <span>Stress: {segment.stresslens_score.toFixed(3)}</span>
                        {typeof segment.stresslens_rank === 'number' && (
                          <span className="text-gray-400">(Rank {segment.stresslens_rank})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content Moderation Warning */}
                  {(() => {
                    const moderation = getModerationLevel(segment);
                    const hasFlags = segment.moderation_harassment_flag || segment.moderation_hate_flag || 
                                   segment.moderation_violence_flag || segment.moderation_sexual_flag || 
                                   segment.moderation_selfharm_flag;
                    
                    if (moderation.level === 'none' && !hasFlags) return null;
                    
                    const levelColors: { [key: string]: string } = {
                      low: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                      medium: 'bg-orange-50 border-orange-200 text-orange-800',
                      high: 'bg-red-50 border-red-200 text-red-800',
                      none: 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    };
                    
                    const flaggedCategories = [];
                    if (segment.moderation_harassment_flag) flaggedCategories.push('Harassment');
                    if (segment.moderation_hate_flag) flaggedCategories.push('Hate');
                    if (segment.moderation_violence_flag) flaggedCategories.push('Violence');
                    if (segment.moderation_sexual_flag) flaggedCategories.push('Sexual');
                    if (segment.moderation_selfharm_flag) flaggedCategories.push('Self-harm');
                    
                    return (
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm ${levelColors[moderation.level]}`}>
                        <Shield className="h-4 w-4" />
                        <span>
                          Content Advisory{moderation.level !== 'none' && ` (${moderation.level})`}: {flaggedCategories.length > 0 ? flaggedCategories.join(', ') : moderation.categories.join(', ')} 
                          {moderation.score > 0 && ` (${(moderation.score * 100).toFixed(1)}%)`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Detailed Analytics (Expandable) */}
                  {(typeof segment.sentiment_harvard_score === 'number' || 
                    typeof segment.sentiment_vader_score === 'number' ||
                    typeof segment.flesch_reading_ease === 'number' ||
                    typeof segment.stresslens_score === 'number') && (
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
                        
                        {/* Stresslens Analytics */}
                        {typeof segment.stresslens_score === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Stresslens Score:</span>
                            <span className={segment.stresslens_score > 0.5 ? 'text-red-600 font-medium' : segment.stresslens_score > 0.3 ? 'text-orange-600' : ''}>
                              {segment.stresslens_score.toFixed(3)}
                            </span>
                          </div>
                        )}
                        
                        {typeof segment.stresslens_rank === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Stresslens Rank:</span>
                            <span>{segment.stresslens_rank}</span>
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
          {segments.filter(s => s.segment_type !== 'announcement').length === 0 && !loadingSegments && (
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

      {/* Similar Segments Modal */}
      {selectedSegmentForSimilar && (
        <React.Suspense fallback={null}>
          <SimilarSegmentsModal
            segmentId={selectedSegmentForSimilar.id}
            segmentText={selectedSegmentForSimilar.transcript_text}
            isOpen={similarModalOpen}
            onClose={() => setSimilarModalOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default VideoDetailPage;
