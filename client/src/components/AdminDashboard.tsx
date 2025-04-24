import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getSettings, updateSettings, clearCache, getSystemStats } from '@/lib/api';
import { SystemStats, ScraperSettings } from '@/lib/types';
import DomainWhitelist from './DomainWhitelist';
import TelegramBotStatus from './TelegramBotStatus';
import ApiStatus from './ApiStatus';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<ScraperSettings | null>(null);
  const [timeout, setTimeout] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsData, settingsData] = await Promise.all([
          getSystemStats(),
          getSettings()
        ]);
        
        setStats(statsData);
        setSettings(settingsData);
        setTimeout(settingsData.timeout);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      getSystemStats()
        .then(data => setStats(data))
        .catch(error => console.error('Failed to refresh stats:', error));
    }, 30000);
    
    return () => clearInterval(interval);
  }, [toast]);
  
  const handleClearCache = async () => {
    try {
      await clearCache();
      toast({
        title: "Success",
        description: "Cache cleared successfully",
      });
      
      // Refresh stats
      const statsData = await getSystemStats();
      setStats(statsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive"
      });
    }
  };
  
  const handleSaveSettings = async (newSettings: Partial<ScraperSettings>) => {
    try {
      const updatedSettings = await updateSettings(newSettings);
      setSettings(updatedSettings);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    }
  };
  
  const handleToggleAutoRetry = async () => {
    if (!settings) return;
    
    await handleSaveSettings({
      autoRetry: !settings.autoRetry
    });
  };
  
  const handleToggleCacheEnabled = async () => {
    if (!settings) return;
    
    await handleSaveSettings({
      cacheEnabled: !settings.cacheEnabled
    });
  };
  
  const handleTimeoutChange = async () => {
    await handleSaveSettings({
      timeout: timeout
    });
  };
  
  if (loading && !settings) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Admin Panel */}
      <div className="lg:col-span-8 bg-darkSecondary p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Admin Dashboard</h2>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
              <span className="w-2 h-2 mr-1 bg-white rounded-full"></span>
              System Online
            </span>
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-darkAccent p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Requests</p>
                <h3 className="text-2xl font-bold">{stats?.totalRequests || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
                <i className="fas fa-server text-primary"></i>
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">
              <i className="fas fa-chart-line"></i> Active monitoring
            </p>
          </div>
          
          <div className="bg-darkAccent p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Cache Hit Rate</p>
                <h3 className="text-2xl font-bold">{stats?.cacheHitRate || 0}%</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500 bg-opacity-20 flex items-center justify-center">
                <i className="fas fa-bolt text-blue-500"></i>
              </div>
            </div>
            <p className="text-xs text-blue-400 mt-2">
              <i className="fas fa-tachometer-alt"></i> Performance metric
            </p>
          </div>
          
          <div className="bg-darkAccent p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Unique Videos</p>
                <h3 className="text-2xl font-bold">{stats?.uniqueVideos || 0}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500 bg-opacity-20 flex items-center justify-center">
                <i className="fas fa-film text-purple-500"></i>
              </div>
            </div>
            <p className="text-xs text-purple-400 mt-2">
              <i className="fas fa-database"></i> Stored in database
            </p>
          </div>
        </div>
        
        {/* Control Panel */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Control Panel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-darkAccent p-4 rounded-lg">
              <h4 className="font-medium mb-3">Cache Management</h4>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm">Cache Status:</span>
                <span className={`px-2 py-1 ${settings?.cacheEnabled ? 'bg-green-500' : 'bg-red-500'} text-xs text-white rounded`}>
                  {settings?.cacheEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="space-y-2">
                <button 
                  className="w-full bg-primary hover:bg-secondary text-white py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                  onClick={handleClearCache}
                >
                  Clear Cache
                </button>
                <button 
                  className="w-full bg-darkSecondary hover:bg-darkAccent text-white py-2 px-4 rounded border border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                  onClick={handleToggleCacheEnabled}
                >
                  {settings?.cacheEnabled ? 'Disable' : 'Enable'} Cache
                </button>
              </div>
            </div>
            
            <div className="bg-darkAccent p-4 rounded-lg">
              <h4 className="font-medium mb-3">Scraper Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center justify-between text-sm mb-1">
                    <span>Timeout (seconds):</span>
                    <input 
                      type="number" 
                      value={timeout} 
                      onChange={e => setTimeout(parseInt(e.target.value))}
                      min="5" 
                      max="120" 
                      className="w-20 bg-darkSecondary border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>
                <div>
                  <label className="flex items-center text-sm">
                    <input 
                      type="checkbox" 
                      checked={settings?.autoRetry} 
                      onChange={handleToggleAutoRetry}
                      className="form-checkbox text-primary rounded focus:ring-primary h-4 w-4"
                    />
                    <span className="ml-2">Auto-retry on failure</span>
                  </label>
                </div>
                <button 
                  className="w-full bg-primary hover:bg-secondary text-white py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                  onClick={handleTimeoutChange}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Domain Whitelist */}
        <DomainWhitelist />
      </div>
      
      {/* Sidebar */}
      <div className="lg:col-span-4 space-y-6">
        {/* Telegram Bot Status */}
        <TelegramBotStatus />
        
        {/* API Status */}
        <ApiStatus />
      </div>
    </div>
  );
};

export default AdminDashboard;
