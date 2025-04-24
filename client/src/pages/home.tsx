import React, { useState } from 'react';
import { useLocation } from 'wouter';
import VideoPlayer from '@/components/VideoPlayer';
import RecentVideos from '@/components/RecentVideos';
import QuickHelp from '@/components/QuickHelp';

const Home: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [searchVideoId, setSearchVideoId] = useState<string>('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoQuality, setVideoQuality] = useState<string>('');
  
  // Check if we have a video ID in the URL (if it matches /taah/:id)
  const pathMatch = location.match(/\/taah\/(\d+)/);
  
  if (pathMatch && pathMatch[1] && currentVideoId !== pathMatch[1]) {
    setCurrentVideoId(pathMatch[1]);
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVideoId) {
      setCurrentVideoId(searchVideoId);
      setLocation(`/taah/${searchVideoId}`);
    }
  };
  
  const handleVideoSelect = (videoId: string) => {
    setSearchVideoId(videoId);
    setCurrentVideoId(videoId);
    setLocation(`/taah/${videoId}`);
  };
  
  const handleVideoLoaded = (url: string, quality: string) => {
    setVideoUrl(url);
    setVideoQuality(quality);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Video Player Section */}
      <div className="lg:col-span-8 bg-darkSecondary p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Video Player</h2>
        
        {/* Video Search Bar */}
        <div className="mb-6">
          <form className="flex items-center" onSubmit={handleSubmit}>
            <div className="relative flex-grow">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <i className="fas fa-search text-gray-400"></i>
              </span>
              <input 
                type="text" 
                placeholder="Enter video ID (e.g., 41517)" 
                className="w-full py-2 px-4 pl-10 bg-darkAccent text-lightText rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={searchVideoId}
                onChange={(e) => setSearchVideoId(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="bg-primary hover:bg-secondary text-white py-2 px-6 rounded-r-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Play
            </button>
          </form>
        </div>
        
        {/* Video Player */}
        <VideoPlayer videoId={currentVideoId} onLoadComplete={handleVideoLoaded} />
        
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Video Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-darkAccent p-3 rounded">
              <span className="text-gray-400 text-sm">Video ID:</span>
              <p className="font-medium">{currentVideoId || '-'}</p>
            </div>
            <div className="bg-darkAccent p-3 rounded">
              <span className="text-gray-400 text-sm">Quality:</span>
              <p className="font-medium">{videoQuality || '-'}</p>
            </div>
            <div className="bg-darkAccent p-3 rounded col-span-2">
              <span className="text-gray-400 text-sm">Extracted URL:</span>
              <p className="font-medium break-all text-xs">{videoUrl || '-'}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Videos & Sidebar */}
      <div className="lg:col-span-4 space-y-6">
        <RecentVideos onSelectVideo={handleVideoSelect} />
        <QuickHelp />
      </div>
    </div>
  );
};

export default Home;
