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
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<Plyr | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');

  // Create video element and plyr instance
  useEffect(() => {
    if (!videoContainerRef.current) return;
    
    // Clean up any existing player
    if (playerInstanceRef.current) {
      playerInstanceRef.current.destroy();
      playerInstanceRef.current = null;
    }
    
    // Clean up existing video element
    if (videoContainerRef.current.firstChild) {
      videoContainerRef.current.innerHTML = '';
    }
    
    // Create new video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.setAttribute('playsinline', '');
    video.setAttribute('controls', '');
    
    // Create source element
    const source = document.createElement('source');
    source.setAttribute('type', 'video/mp4');
    
    // Add fallback text
    video.innerText = 'Your browser does not support the video tag.';
    
    // Append elements
    video.appendChild(source);
    videoContainerRef.current.appendChild(video);
    
    // Initialize Plyr
    playerInstanceRef.current = new Plyr(video, {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'mute', 
        'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ]
    });
    
    // Save reference to video element
    setVideoElement(video);
    
    return () => {
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  }, []);

  // Load video when videoId changes
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoId || !videoElement) {
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const video = await getVideo(videoId);
        const videoUrl = video.url;
        
        // Update source element
        const sourceElement = videoElement.querySelector('source');
        if (sourceElement) {
          sourceElement.setAttribute('src', videoUrl);
        }
        
        // Set video URL directly on video element as well
        videoElement.setAttribute('src', videoUrl);
        
        // Load the new source
        videoElement.load();
        
        // Update current URL
        setCurrentVideoUrl(videoUrl);
        
        // Play the video after loading
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Auto-play was prevented:', error);
          });
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
  }, [videoId, videoElement, onLoadComplete, toast]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
      {/* Video Player Container */}
      <div ref={videoContainerRef} className="w-full h-full"></div>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
            <p className="text-white">Loading video...</p>
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
