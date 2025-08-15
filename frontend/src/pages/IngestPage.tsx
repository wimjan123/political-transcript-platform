import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Youtube, 
  Key, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Eye,
  Database,
  Zap
} from 'lucide-react';
import { YouTubeVideoInfo, IngestStatus, OpenAIKeyTestResult } from '../types';
import { ingestAPI } from '../services/api';

const IngestPage: React.FC = () => {
  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [speakerOverride, setSpeakerOverride] = useState('');

  // Video info state
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [videoInfoLoading, setVideoInfoLoading] = useState(false);
  const [videoInfoError, setVideoInfoError] = useState<string | null>(null);

  // API key validation state
  const [apiKeyStatus, setApiKeyStatus] = useState<OpenAIKeyTestResult | null>(null);
  const [apiKeyTesting, setApiKeyTesting] = useState(false);

  // Processing state
  const [processingStatuses, setProcessingStatuses] = useState<Record<string, IngestStatus>>({});
  const [loading, setLoading] = useState(false);

  // Auto-refresh processing statuses
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const statuses = await ingestAPI.getAllProcessingStatus();
        setProcessingStatuses(statuses);
      } catch (error) {
        console.error('Error fetching processing statuses:', error);
      }
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Extract YouTube video ID for status tracking
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleGetVideoInfo = async () => {
    if (!youtubeUrl.trim()) return;
    
    setVideoInfoLoading(true);
    setVideoInfoError(null);
    setVideoInfo(null);

    try {
      const info = await ingestAPI.getYouTubeInfo(youtubeUrl);
      setVideoInfo(info);
      
      // Auto-populate title and speaker if not overridden
      if (!titleOverride) {
        setTitleOverride(info.title);
      }
      if (!speakerOverride) {
        setSpeakerOverride(info.uploader);
      }
    } catch (error: any) {
      setVideoInfoError(error.response?.data?.detail || error.message || 'Failed to get video information');
    } finally {
      setVideoInfoLoading(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!openaiApiKey.trim()) return;
    
    setApiKeyTesting(true);
    try {
      const result = await ingestAPI.testOpenAIKey(openaiApiKey);
      setApiKeyStatus(result);
    } catch (error) {
      setApiKeyStatus({
        valid: false,
        whisper_available: false,
        message: 'API key test failed'
      });
    } finally {
      setApiKeyTesting(false);
    }
  };

  const handleStartIngestion = async () => {
    if (!youtubeUrl.trim() || !openaiApiKey.trim()) {
      alert('Please provide both YouTube URL and OpenAI API key');
      return;
    }

    setLoading(true);
    try {
      const request = {
        url: youtubeUrl,
        openai_api_key: openaiApiKey,
        title_override: titleOverride || undefined,
        speaker_override: speakerOverride || undefined,
      };

      await ingestAPI.startYouTubeIngestion(request);
      
      // Clear form
      setYoutubeUrl('');
      setOpenaiApiKey('');
      setTitleOverride('');
      setSpeakerOverride('');
      setVideoInfo(null);
      setApiKeyStatus(null);
      
      alert('Video processing started! Check the status below.');
    } catch (error: any) {
      alert(`Failed to start processing: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearStatus = async (videoId: string) => {
    try {
      await ingestAPI.clearProcessingStatus(videoId);
      const updatedStatuses = { ...processingStatuses };
      delete updatedStatuses[videoId];
      setProcessingStatuses(updatedStatuses);
    } catch (error) {
      console.error('Error clearing status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Upload className="h-8 w-8 mr-3 text-primary-600" />
            Video Ingest
          </h1>
          <p className="text-gray-600 mt-2">
            Add new video transcripts by uploading YouTube videos and transcribing them with OpenAI Whisper
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Youtube className="h-5 w-5 mr-2 text-red-600" />
              YouTube Video Ingestion
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* YouTube URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL *
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleGetVideoInfo}
                  disabled={!youtubeUrl.trim() || videoInfoLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <Eye className={`h-4 w-4 mr-1 ${videoInfoLoading ? 'animate-spin' : ''}`} />
                  {videoInfoLoading ? 'Loading...' : 'Preview'}
                </button>
              </div>
              {videoInfoError && (
                <p className="mt-2 text-sm text-red-600">{videoInfoError}</p>
              )}
            </div>

            {/* Video Info Preview */}
            {videoInfo && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Video Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Title:</span>
                      <p className="text-sm text-gray-600">{videoInfo.title}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Channel:</span>
                      <p className="text-sm text-gray-600">{videoInfo.uploader}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Duration:</span>
                      <p className="text-sm text-gray-600">{formatDuration(videoInfo.duration)}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <img 
                      src={videoInfo.thumbnail} 
                      alt="Video thumbnail"
                      className="w-48 h-auto rounded-lg border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* OpenAI API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key *
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleTestApiKey}
                  disabled={!openaiApiKey.trim() || apiKeyTesting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Key className={`h-4 w-4 mr-1 ${apiKeyTesting ? 'animate-spin' : ''}`} />
                  {apiKeyTesting ? 'Testing...' : 'Test'}
                </button>
              </div>
              
              {apiKeyStatus && (
                <div className={`mt-2 p-3 rounded-md ${apiKeyStatus.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {apiKeyStatus.valid ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <p className={`text-sm ${apiKeyStatus.valid ? 'text-green-700' : 'text-red-700'}`}>
                      {apiKeyStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Overrides */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title Override (optional)
                </label>
                <input
                  type="text"
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  placeholder="Custom title for the video"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker Override (optional)
                </label>
                <input
                  type="text"
                  value={speakerOverride}
                  onChange={(e) => setSpeakerOverride(e.target.value)}
                  placeholder="Custom speaker name"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                onClick={handleStartIngestion}
                disabled={!youtubeUrl.trim() || !openaiApiKey.trim() || loading || !apiKeyStatus?.valid}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Play className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Starting Processing...' : 'Start Processing'}
              </button>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {Object.keys(processingStatuses).length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Database className="h-5 w-5 mr-2 text-blue-600" />
                Processing Status
              </h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(processingStatuses).map(([videoId, status]) => (
                  <div key={videoId} className={`border rounded-lg p-4 ${getStatusColor(status.status)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getStatusIcon(status.status)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900">
                              Video ID: {videoId}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              status.status === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : status.status === 'error'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {status.status}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {status.progress}
                          </p>
                          
                          {status.error && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              {status.error}
                            </div>
                          )}
                          
                          {status.result && (
                            <div className="mt-2 p-3 bg-green-100 border border-green-200 rounded">
                              <h4 className="text-sm font-medium text-green-800 flex items-center">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Processing Complete
                              </h4>
                              <div className="mt-2 text-sm text-green-700 space-y-1">
                                <p><strong>Title:</strong> {status.result.title}</p>
                                <p><strong>Segments:</strong> {status.result.total_segments}</p>
                                <p><strong>Duration:</strong> {formatDuration(status.result.total_duration)}</p>
                                <p><strong>Database ID:</strong> {status.result.video_id}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs text-gray-500">
                            Started: {new Date(status.started_at!).toLocaleString()}
                            {status.completed_at && (
                              <span className="ml-3">
                                Completed: {new Date(status.completed_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleClearStatus(videoId)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Clear status"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <Zap className="h-6 w-6 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-2">How it works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Paste a YouTube URL and we'll extract the video metadata</li>
                <li>• Provide your OpenAI API key for transcription with Whisper</li>
                <li>• The video will be downloaded, transcribed, and processed</li>
                <li>• Transcript segments will be saved to the database with timestamps</li>
                <li>• The processed video will be searchable immediately after completion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngestPage;