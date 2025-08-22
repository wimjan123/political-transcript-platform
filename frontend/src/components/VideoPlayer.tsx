import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Download } from 'lucide-react';

interface VideoPlayerProps {
  videoId: number;
  videoTitle: string;
  hasSubtitles?: boolean;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
  width?: string;
  height?: string;
}

interface VideoInfo {
  id: number;
  title: string;
  filename: string;
  video_duration_seconds?: number;
  video_resolution?: string;
  transcoding_status?: string;
  playback_ready: boolean;
  has_subtitles: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  videoTitle,
  hasSubtitles = false,
  className = '',
  autoplay = false,
  controls = true,
  width = '100%',
  height = 'auto'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(hasSubtitles);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch video info on mount
  useEffect(() => {
    const fetchVideoInfo = async () => {
      try {
        const response = await fetch(`/api/video-files/${videoId}/info`);
        if (response.ok) {
          const info = await response.json();
          setVideoInfo(info);
          if (!info.playback_ready) {
            setError('Video is still being processed for playback. Please try again later.');
          }
        } else {
          setError('Failed to load video information');
        }
      } catch (err) {
        setError('Failed to load video information');
        console.error('Error fetching video info:', err);
      }
    };

    fetchVideoInfo();
  }, [videoId]);

  // Set up video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoading(false);
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setError('Failed to load video. The video may be corrupted or in an unsupported format.');
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (!controls) return;

    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    resetControlsTimeout();

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, controls]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        await video.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error toggling play state:', err);
      setError('Failed to play video');
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(event.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(event.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await video.requestFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadVideo = () => {
    const link = document.createElement('a');
    link.href = `/api/video-files/${videoId}/stream`;
    link.download = videoInfo?.filename || `video_${videoId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center ${className}`}>
        <div className="text-red-600 dark:text-red-400 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">Video Error</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      style={{ width, height: height === 'auto' ? undefined : height }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setTimeout(() => setShowControls(false), 1000)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay={autoplay}
        muted={isMuted}
        preload="metadata"
        playsInline
      >
        <source src={`/api/video-files/${videoId}/stream`} type="video/mp4" />
        {hasSubtitles && showSubtitles && (
          <track
            kind="subtitles"
            src={`/api/video-files/${videoId}/subtitles`}
            srcLang="en"
            label="English"
            default
          />
        )}
        Your browser does not support the video tag.
      </video>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading video...</p>
            {videoInfo?.transcoding_status === 'processing' && (
              <p className="text-sm mt-2">Video is being processed...</p>
            )}
          </div>
        </div>
      )}

      {/* Video Title Overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-4">
        <h3 className="text-white text-lg font-medium truncate">{videoTitle}</h3>
        {videoInfo && (
          <p className="text-gray-300 text-sm">
            {videoInfo.video_resolution} • {formatTime(videoInfo.video_duration_seconds || 0)}
          </p>
        )}
      </div>

      {/* Controls */}
      {controls && (
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center text-white text-sm mb-2">
              <span className="mr-2">{formatTime(currentTime)}</span>
              <div className="flex-1 mx-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <span className="ml-2">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-blue-400 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Subtitles Toggle */}
              {hasSubtitles && (
                <button
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`text-white hover:text-blue-400 transition-colors text-sm ${
                    showSubtitles ? 'bg-blue-600' : 'bg-gray-600'
                  } px-2 py-1 rounded`}
                  aria-label="Toggle Subtitles"
                >
                  CC
                </button>
              )}

              {/* Download */}
              <button
                onClick={downloadVideo}
                className="text-white hover:text-blue-400 transition-colors"
                aria-label="Download Video"
              >
                <Download size={20} />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-blue-400 transition-colors"
                aria-label="Fullscreen"
              >
                <Maximize size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;