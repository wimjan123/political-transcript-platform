import React from 'react';
import { Play } from 'lucide-react';

interface VimeoEmbedProps {
  vimeoVideoId?: string;
  vimeoEmbedUrl?: string;
  title?: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  thumbnail?: string;
  showThumbnail?: boolean;
  onPlay?: () => void;
}

const VimeoEmbed: React.FC<VimeoEmbedProps> = ({
  vimeoVideoId,
  vimeoEmbedUrl,
  title = "Video",
  width = "100%",
  height = 400,
  autoplay = false,
  thumbnail,
  showThumbnail = false,
  onPlay
}) => {
  const [isPlaying, setIsPlaying] = React.useState(!showThumbnail);
  
  // If no Vimeo data is available, show a placeholder
  if (!vimeoVideoId && !vimeoEmbedUrl) {
    return (
      <div 
        style={{ width, height }}
        className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
      >
        <div className="text-center text-gray-500">
          <Play className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium">Video not available</p>
          <p className="text-xs">This might be a press release or transcript-only content</p>
        </div>
      </div>
    );
  }
  
  // Construct embed URL if we have video ID but no full URL
  let embedUrl = vimeoEmbedUrl;
  if (!embedUrl && vimeoVideoId) {
    embedUrl = `https://player.vimeo.com/video/${vimeoVideoId}?h=e5126f6f23&badge=0&autopause=0&player_id=0&app_id=58479&play_button_position=bottom`;
    if (autoplay) {
      embedUrl += '&autoplay=1';
    }
  }
  
  const handlePlay = () => {
    setIsPlaying(true);
    onPlay?.();
  };
  
  // Show thumbnail with play button overlay
  if (showThumbnail && !isPlaying && thumbnail) {
    return (
      <div 
        style={{ width, height }}
        className="relative bg-black rounded-lg overflow-hidden cursor-pointer group"
        onClick={handlePlay}
      >
        <img
          src={thumbnail}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center group-hover:bg-opacity-60 transition-colors">
          <div className="bg-white bg-opacity-90 rounded-full p-4 group-hover:bg-opacity-100 transition-colors">
            <Play className="h-8 w-8 text-gray-800" fill="currentColor" />
          </div>
        </div>
      </div>
    );
  }
  
  // Show iframe embed
  if (embedUrl) {
    return (
      <div style={{ width, height }} className="rounded-lg overflow-hidden">
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={title}
          className="rounded-lg"
        />
      </div>
    );
  }
  
  return null;
};

export default VimeoEmbed;
