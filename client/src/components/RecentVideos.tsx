import React, { useEffect, useState } from 'react';
import { getRecentVideos } from '@/lib/api';
import { Video } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface RecentVideosProps {
  onSelectVideo: (videoId: string) => void;
}

const RecentVideos: React.FC<RecentVideosProps> = ({ onSelectVideo }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecentVideos = async () => {
      setLoading(true);
      try {
        const recentVideos = await getRecentVideos(5);
        setVideos(recentVideos);
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to load recent videos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecentVideos();
  }, [toast]);

  const handleVideoSelect = (videoId: string) => {
    onSelectVideo(videoId);
  };

  return (
    <div className="bg-darkSecondary p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Recent Videos</h2>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <p>No recent videos found</p>
            </div>
          ) : (
            videos.map((video) => (
              <div 
                key={video.id}
                className="flex items-start space-x-3 p-3 bg-darkAccent rounded-lg hover:bg-opacity-70 cursor-pointer transition-colors"
                onClick={() => handleVideoSelect(video.videoId)}
              >
                <div className="flex-shrink-0 w-16 h-12 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                  <i className="fas fa-film text-2xl text-gray-500"></i>
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="font-medium truncate">{video.title || `Video ${video.videoId}`}</h3>
                  <p className="text-xs text-gray-400">ID: {video.videoId}</p>
                </div>
                <button className="text-primary hover:text-secondary">
                  <i className="fas fa-play-circle"></i>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RecentVideos;
