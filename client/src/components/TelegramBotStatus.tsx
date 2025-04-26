import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  getTelegramStatus, 
  startTelegramBot, 
  stopTelegramBot, 
  enableChannelStorage,
  disableChannelStorage,
  verifyChannelAccess
} from '@/lib/api';
import { TelegramStatus } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertCircle, Bot, Database, Info, Play, RefreshCw, Square, 
  ExternalLink, MessageSquare, Copy, Check, Send, ArrowRight
} from 'lucide-react';

const TelegramBotStatus: React.FC = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [channelId, setChannelId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [botUsername, setBotUsername] = useState<string>('');
  const [verifyingChannel, setVerifyingChannel] = useState<boolean>(false);
  const [channelVerificationStatus, setChannelVerificationStatus] = useState<{
    verified: boolean;
    message: string;
    correctedId?: string;
  } | null>(null);
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
    
    // Extract bot username if token is available
    if (status?.botToken) {
      // Try to fetch bot info from the API
      apiRequest('GET', '/api/telegram/bot/info')
        .then(response => response.json())
        .then(data => {
          if (data.success && data.username) {
            setBotUsername(data.username);
          }
        })
        .catch(error => {
          console.error('Failed to fetch bot username:', error);
          // Fallback to a placeholder
          setBotUsername('your_bot');
        });
      
      // Set fallback username if we can't get it from API
      if (!botUsername) {
        setBotUsername('your_bot');
      }
    }
  }, [status]);
  
  const handleCopyBotLink = () => {
    const botLink = `https://t.me/${botUsername}`;
    navigator.clipboard.writeText(botLink)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        toast({
          title: "Success",
          description: "Bot link copied to clipboard",
        });
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to copy to clipboard",
          variant: "destructive"
        });
      });
  };
  
  const openTelegramBot = () => {
    if (!botUsername) {
      toast({
        title: "Info",
        description: "Bot username not available",
        variant: "default"
      });
      return;
    }
    
    const botLink = `https://t.me/${botUsername}`;
    window.open(botLink, '_blank');
  };
  
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
  
  const handleVerifyChannel = async () => {
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
        description: "Bot must be running to verify channel access",
        variant: "destructive"
      });
      return;
    }
    
    setVerifyingChannel(true);
    setChannelVerificationStatus(null);
    
    try {
      const result = await verifyChannelAccess(channelId);
      
      setChannelVerificationStatus({
        verified: result.valid,
        message: result.message,
        correctedId: result.correctedId
      });
      
      // If the verification returned a corrected ID, update the input field
      if (result.correctedId) {
        setChannelId(result.correctedId);
      }
      
      if (result.valid) {
        toast({
          title: "Success",
          description: "Channel verification successful",
        });
      } else {
        toast({
          title: "Warning",
          description: "Channel verification failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify channel access",
        variant: "destructive"
      });
      setChannelVerificationStatus(null);
    } finally {
      setVerifyingChannel(false);
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
    
    // If channel hasn't been verified yet, verify it first
    if (!channelVerificationStatus?.verified) {
      toast({
        title: "Info",
        description: "Verifying channel access first...",
      });
      
      await handleVerifyChannel();
      
      // If verification failed, don't proceed
      if (!channelVerificationStatus?.verified) {
        return;
      }
    }
    
    setActionLoading(true);
    try {
      // Use the corrected ID if available
      const idToUse = channelVerificationStatus?.correctedId || channelId;
      
      await enableChannelStorage(idToUse);
      toast({
        title: "Success",
        description: "Channel storage enabled successfully",
      });
      fetchStatus();
      setChannelVerificationStatus(null); // Reset verification status
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
            variant={status?.active ? "default" : "destructive"}
            className={`ml-2 ${status?.active ? "bg-green-600 hover:bg-green-700" : ""}`}
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
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1 font-medium">
                        <Info className="h-4 w-4" />
                        Bot Commands
                      </div>
                      <div className="text-xs text-muted-foreground pl-6">
                        /help - Show help<br />
                        /status - Show bot status<br />
                        /channel enable ChannelID - Enable storage<br />
                        /channel disable - Disable storage
                      </div>
                    </div>
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
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1 font-medium">
                        <Info className="h-4 w-4" />
                        Channel Storage
                      </div>
                      <div className="text-xs text-muted-foreground pl-6">
                        Enable channel storage to save data to a Telegram channel. 
                        The channel ID should start with a minus sign (e.g., -1001234567890).
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  {status?.active && (
                    <div className="space-y-4">
                      {!status.channelStorageEnabled ? (
                        <div className="grid gap-2">
                          <Label htmlFor="channelId">Channel ID</Label>
                          <div className="flex flex-col space-y-2">
                            <div className="flex space-x-2">
                              <Input
                                id="channelId"
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="-1001234567890"
                                disabled={actionLoading || verifyingChannel}
                                className="flex-1"
                              />
                              <Button 
                                onClick={handleVerifyChannel}
                                disabled={actionLoading || verifyingChannel || !channelId}
                                size="sm"
                                variant="outline"
                                className="whitespace-nowrap"
                              >
                                {verifyingChannel ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Verifying...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 mr-1" />
                                    Verify Access
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {channelVerificationStatus && (
                              <div className={`p-2 text-xs rounded ${
                                channelVerificationStatus.verified 
                                  ? "bg-green-100 text-green-800 border border-green-200" 
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}>
                                <div className="font-medium mb-1 flex items-center">
                                  {channelVerificationStatus.verified ? (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Channel Verified
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Channel Verification Failed
                                    </>
                                  )}
                                </div>
                                <div className="text-xs opacity-90">{channelVerificationStatus.message}</div>
                                
                                {channelVerificationStatus.correctedId && (
                                  <div className="mt-1 text-xs opacity-80">
                                    ID corrected to: <span className="font-mono">{channelVerificationStatus.correctedId}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <Button 
                              onClick={handleEnableChannelStorage}
                              disabled={actionLoading || !channelId}
                              size="sm"
                              className="mt-2"
                            >
                              {actionLoading ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Enabling...
                                </>
                              ) : (
                                <>
                                  <Database className="h-3 w-3 mr-1" />
                                  Enable Storage
                                </>
                              )}
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
        
        <CardFooter className="flex flex-col space-y-4 border-t pt-5">
          <div className="flex justify-between w-full items-center">
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
          </div>
          
          {/* Bot Quick Access Section */}
          {status?.active && botUsername && (
            <div className="w-full pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium mb-1">Quick Access</h4>
                  <p className="text-xs text-muted-foreground">
                    Access your Telegram bot directly with these shortcuts
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={handleCopyBotLink}
                  >
                    {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copy Link
                  </Button>
                  
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={openTelegramBot}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Bot
                  </Button>
                </div>
              </div>
              
              {botUsername && (
                <div className="mt-2 p-2 bg-primary/5 rounded-md border border-primary/10 flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 text-blue-400 mr-2" />
                    <span className="text-xs font-mono">@{botUsername}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">t.me/{botUsername}</span>
                </div>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default TelegramBotStatus;
