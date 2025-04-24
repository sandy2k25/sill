import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getTelegramStatus, startTelegramBot, stopTelegramBot } from '@/lib/api';
import { TelegramStatus } from '@/lib/types';

const TelegramBotStatus: React.FC = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchStatus();
    
    // Refresh status every minute
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const statusData = await getTelegramStatus();
      setStatus(statusData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch Telegram bot status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartBot = async () => {
    if (!status?.botToken) {
      toast({
        title: "Error",
        description: "No Telegram bot token configured",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await startTelegramBot();
      toast({
        title: "Success",
        description: "Telegram bot started successfully",
      });
      fetchStatus();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start Telegram bot",
        variant: "destructive"
      });
    }
  };
  
  const handleStopBot = async () => {
    try {
      await stopTelegramBot();
      toast({
        title: "Success",
        description: "Telegram bot stopped successfully",
      });
      fetchStatus();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop Telegram bot",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="bg-darkSecondary p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Telegram Bot</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Bot Status:</span>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
          ) : (
            <span className={`px-2 py-1 ${status?.active ? 'bg-green-500' : 'bg-red-500'} text-xs text-white rounded-full`}>
              {status?.active ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        
        <div className="bg-darkAccent p-3 rounded-lg">
          <h3 className="font-medium text-sm mb-2">Bot Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Bot Token:</span>
              <span>{status?.botToken ? 'Configured' : 'Not Configured'}</span>
            </div>
            {status?.botToken && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Username:</span>
                  <span>@VideoScraperBot</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Commands:</span>
                  <span>/help, /status, /scrape</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {status?.botToken && (
          <button 
            className="w-full bg-primary hover:bg-secondary text-white py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
            onClick={status.active ? handleStopBot : handleStartBot}
          >
            {status.active ? 'Stop Bot' : 'Start Bot'}
          </button>
        )}
        
        {!status?.botToken && (
          <div className="text-sm text-yellow-400 bg-yellow-500 bg-opacity-20 p-3 rounded">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            No Telegram bot token configured. Set the TELEGRAM_BOT_TOKEN environment variable.
          </div>
        )}
      </div>
    </div>
  );
};

export default TelegramBotStatus;
