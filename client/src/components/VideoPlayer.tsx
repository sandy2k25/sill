import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { getVideo } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VideoPlayerProps {
  videoId: string | null;
  onLoadComplete?: (videoUrl: string, quality: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onLoadComplete }) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const playerInstanceRef = useRef<Plyr | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize player
    if (playerRef.current && !playerInstanceRef.current) {
      playerInstanceRef.current = new Plyr(playerRef.current, {
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'mute', 
          'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
        ]
      });
    }

    return () => {
      // Cleanup
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadVideo = async () => {
      if (!videoId) {
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const video = await getVideo(videoId);
        
        if (playerInstanceRef.current) {
          playerInstanceRef.current.source = {
            type: 'video',
            sources: [{
              src: video.url,
              type: 'video/mp4',
            }]
          };
        }
        
        // Call callback with video data
        if (onLoadComplete) {
          onLoadComplete(video.url, video.quality);
        }
        
        toast({
          title: 'Success',
          description: 'Video loaded successfully',
          variant: 'default',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load video';
        setError(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId, onLoadComplete, toast]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
      {/* Plyr Video Player */}
      <video ref={playerRef} playsInline controls>
        <source src="" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-dark bg-opacity-70 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
            <p>Loading video...</p>
          </div>
        </div>
      )}
      
      {/* Error or Empty State */}
      {!loading && !videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <i className="fas fa-film text-6xl text-gray-600 mb-4"></i>
          <p className="text-gray-400">Enter a video ID to start playing</p>
        </div>
      )}
      
      {!loading && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <i className="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
