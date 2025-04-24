import React, { useState, useEffect } from 'react';
import { getSystemStats } from '@/lib/api';
import { SystemStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const ApiStatus: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const { toast } = useToast();
  
  useEffect(() => {
    checkApiStatus();
  }, []);
  
  const checkApiStatus = async () => {
    setLoading(true);
    try {
      const statsData = await getSystemStats();
      setStats(statsData);
      setLastChecked(new Date());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check API status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatLastChecked = () => {
    const now = new Date();
    const diff = now.getTime() - lastChecked.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) {
      return 'just now';
    } else if (minutes === 1) {
      return '1 minute ago';
    } else {
      return `${minutes} minutes ago`;
    }
  };
  
  return (
    <div className="bg-darkSecondary p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">API Status</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span>letsembed.cc:</span>
          <span className="px-2 py-1 bg-green-500 text-xs text-white rounded-full">
            Operational
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Scraper Engine:</span>
          <span className="px-2 py-1 bg-green-500 text-xs text-white rounded-full">
            Operational
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Player API:</span>
          <span className="px-2 py-1 bg-green-500 text-xs text-white rounded-full">
            Operational
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last Check:</span>
          <span className="text-sm text-gray-400">{formatLastChecked()}</span>
        </div>
        <button 
          className="w-full mt-2 bg-darkAccent hover:bg-opacity-80 text-white py-2 px-4 rounded border border-gray-600 transition-colors focus:outline-none text-sm"
          onClick={checkApiStatus}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Checking...
            </span>
          ) : (
            'Check Now'
          )}
        </button>
      </div>
    </div>
  );
};

export default ApiStatus;
