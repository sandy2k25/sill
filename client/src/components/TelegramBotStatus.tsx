import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  getTelegramStatus, 
  startTelegramBot, 
  stopTelegramBot, 
  enableChannelStorage,
  disableChannelStorage
} from '@/lib/api';
import { TelegramStatus } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Bot, Database, Info, Play, RefreshCw, Square } from 'lucide-react';

const TelegramBotStatus: React.FC = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [channelId, setChannelId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchStatus();
    
    // Refresh status every minute
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (status?.channelId) {
      setChannelId(status.channelId);
    }
  }, [status]);
  
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
    
    setActionLoading(true);
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
  
  const handleEnableChannelStorage = async () => {
    if (!channelId || !channelId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid channel ID",
        variant: "destructive"
      });
      return;
    }
    
    if (!status?.active) {
      toast({
        title: "Error",
        description: "Bot must be running to enable channel storage",
        variant: "destructive"
      });
      return;
    }
    
    setActionLoading(true);
    try {
      await enableChannelStorage(channelId);
      toast({
        title: "Success",
        description: "Channel storage enabled successfully",
      });
      fetchStatus();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to enable channel storage",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleDisableChannelStorage = async () => {
    setActionLoading(true);
    try {
      await disableChannelStorage();
      toast({
        title: "Success",
        description: "Channel storage disabled successfully",
      });
      fetchStatus();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable channel storage",
        variant: "destructive"
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-bold">Telegram Bot</CardTitle>
            <CardDescription>Control bot and channel storage settings</CardDescription>
          </div>
          <Badge 
            variant={status?.active ? "success" : "destructive"}
            className="ml-2"
          >
            {status?.active ? 'Online' : 'Offline'}
          </Badge>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Bot Control Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Bot Control</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Bot Token: <span className={status?.botToken ? "text-green-500" : "text-red-500"}>
                      {status?.botToken ? 'Configured' : 'Not Configured'}
                    </span>
                  </p>
                  
                  {status?.botToken && status?.active && (
                    <Alert variant="outline" className="bg-primary/5 border-primary/20">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Bot Commands</AlertTitle>
                      <AlertDescription className="text-xs">
                        /help - Show help<br />
                        /status - Show bot status<br />
                        /channel enable ChannelID - Enable storage<br />
                        /channel disable - Disable storage
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <div className="flex justify-end">
                  {status?.botToken && (
                    <Button 
                      variant={status.active ? "destructive" : "default"}
                      size="sm"
                      onClick={status.active ? handleStopBot : handleStartBot}
                      disabled={actionLoading}
                      className="flex items-center gap-2"
                    >
                      {status.active ? (
                        <>
                          <Square className="h-4 w-4" />
                          Stop Bot
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Start Bot
                        </>
                      )}
                    </Button>
                  )}
                  
                  {!status?.botToken && (
                    <Alert variant="destructive" className="w-full">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Missing Bot Token</AlertTitle>
                      <AlertDescription>
                        Set the TELEGRAM_BOT_TOKEN environment variable.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
            
            {/* Channel Storage Section */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Channel Storage</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Storage Status: <span className={status?.channelStorageEnabled ? "text-green-500" : "text-muted-foreground"}>
                      {status?.channelStorageEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                  
                  {status?.channelStorageEnabled && status?.channelId && (
                    <p className="text-sm text-muted-foreground">
                      Current Channel ID: <span className="font-mono text-xs">{status.channelId}</span>
                    </p>
                  )}
                  
                  {status?.active && !status?.channelStorageEnabled && (
                    <Alert variant="outline" className="bg-primary/5 border-primary/20">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Channel Storage</AlertTitle>
                      <AlertDescription className="text-xs">
                        Enable channel storage to save data to a Telegram channel. 
                        The channel ID should start with a minus sign (e.g., -1001234567890).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <div>
                  {status?.active && (
                    <div className="space-y-4">
                      {!status.channelStorageEnabled ? (
                        <div className="grid gap-2">
                          <Label htmlFor="channelId">Channel ID</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="channelId"
                              value={channelId}
                              onChange={(e) => setChannelId(e.target.value)}
                              placeholder="-1001234567890"
                              disabled={actionLoading}
                              className="flex-1"
                            />
                            <Button 
                              onClick={handleEnableChannelStorage}
                              disabled={actionLoading || !channelId}
                              size="sm"
                            >
                              Enable
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Button 
                            variant="destructive"
                            size="sm"
                            onClick={handleDisableChannelStorage}
                            disabled={actionLoading}
                          >
                            Disable Storage
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t pt-5">
          <p className="text-xs text-muted-foreground">
            Channel storage allows saving data to a Telegram channel for backup and persistence.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TelegramBotStatus;
