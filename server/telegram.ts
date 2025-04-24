import { Telegraf, Context } from 'telegraf';
import { Domain, Video, Log, ScraperSettings, InsertVideo, InsertDomain, InsertLog } from '@shared/schema';
import type { IStorage } from './storage';

// We'll set storage instance and videoScraper later to avoid circular dependency
let storageInstance: IStorage | null = null;
let videoScraperInstance: any = null;

// Create a new bot instance if TELEGRAM_BOT_TOKEN is provided
// Interface for the Telegram channel database
interface TelegramDB {
  channelId: string | undefined;
  enabled: boolean;
}

export class TelegramBot {
  private bot: Telegraf | null = null;
  private isRunning: boolean = false;
  private adminUsers: Set<number> = new Set();
  
  // Telegram channel storage configuration
  private channelStorage: TelegramDB = {
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    enabled: process.env.TELEGRAM_CHANNEL_ID ? true : false // Auto-enable if channel ID is provided
  };
  
  constructor() {
    // We'll initialize the bot when storage is set
  }
  
  /**
   * Set the storage instance after initialization to avoid circular dependency
   */
  setStorage(storage: IStorage) {
    storageInstance = storage;
    console.log('Storage instance set in TelegramBot');
    
    // Now we can initialize the bot if token is provided
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token.length > 10) {
      this.initializeBot(token);
    }
  }
  
  /**
   * Set the video scraper instance after initialization to avoid circular dependency
   */
  setVideoScraper(scraper: any) {
    videoScraperInstance = scraper;
    console.log('VideoScraper instance set in TelegramBot');
  }
  
  private initializeBot(token: string) {
    try {
      this.bot = new Telegraf(token);
      console.log('Telegram bot created with token');
      
      // Make sure the bot was created successfully
      if (!this.bot) {
        throw new Error('Failed to create Telegram bot instance');
      }
      
      // Add admin verification middleware to all commands
      this.bot.use(async (ctx, next) => {
        if (ctx.from && this.isAdminUser(ctx.from.id)) {
          return next();
        } else if (ctx.from && ctx.message) {
          // Verify password if provided
          if ('text' in ctx.message && ctx.message.text?.startsWith('/admin ')) {
            const password = ctx.message.text.split(' ')[1];
            if (password && this.verifyAdminPassword(password)) {
              this.adminUsers.add(ctx.from.id);
              await ctx.reply('✅ You are now authorized as admin.');
              return;
            }
          }
          await ctx.reply('⚠️ You are not authorized. Use /admin <password> to authenticate.');
        }
      });

      // Register command handlers
      this.registerCommands();
      
      // Only log if storage is set
      if (storageInstance) {
        storageInstance.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Telegram bot initialized'
        });
      }
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      // Explicitly set bot to null on error
      this.bot = null;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }
  
  /**
   * Register command handlers for the bot
   */
  private registerCommands() {
    if (!this.bot) return;
    
    // Start command - shows welcome message and menu
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *Video Scraper Bot*\n\n' +
        'Welcome to the admin interface for the Video Scraper service.\n' +
        'Use the commands below to manage the service:\n\n' +
        '/menu - Show this menu\n' +
        '/stats - Show system statistics\n' +
        '/settings - Show current settings\n' +
        '/domains - Manage whitelisted domains\n' +
        '/cache - Manage video cache\n' +
        '/logs - View recent logs\n' +
        '/channel - Configure channel storage\n' +
        '/help - Show help information',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Menu command - shows available commands
    this.bot.command('menu', async (ctx) => {
      await ctx.reply(
        '📋 *Available Commands*\n\n' +
        '/stats - Show system statistics\n' +
        '/settings - Show current settings\n' +
        '/domains - Manage whitelisted domains\n' +
        '/cache - Manage video cache\n' +
        '/logs - View recent logs\n' +
        '/channel - Configure channel storage\n' +
        '/help - Show help information',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '/stats' }, { text: '/settings' }],
              [{ text: '/domains' }, { text: '/cache' }],
              [{ text: '/logs' }, { text: '/channel' }],
              [{ text: '/help' }]
            ],
            resize_keyboard: true
          }
        }
      );
    });
    
    // Stats command - shows system statistics
    this.bot.command('stats', async (ctx) => {
      if (!videoScraperInstance || !storageInstance) {
        await ctx.reply('⚠️ System statistics not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        const videos = await storageInstance.getRecentVideos(1000); // Get all videos up to 1000
        const domains = await storageInstance.getAllDomains();
        
        const stats = {
          totalVideos: videos.length,
          totalDomains: domains.length,
          activeDomains: domains.filter(d => d.active).length,
          cacheEnabled: settings.cacheEnabled,
          cacheTTL: settings.cacheTTL
        };
        
        await ctx.reply(
          '📊 *System Statistics*\n\n' +
          `Total Videos: ${stats.totalVideos}\n` +
          `Total Domains: ${stats.totalDomains}\n` +
          `Active Domains: ${stats.activeDomains}\n` +
          `Cache Enabled: ${stats.cacheEnabled ? 'Yes' : 'No'}\n` +
          `Cache TTL: ${stats.cacheTTL} minutes\n`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await ctx.reply(`⚠️ Error fetching statistics: ${errorMessage}`);
      }
    });
    
    // Settings command - shows and manages settings
    this.bot.command('settings', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Settings not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        
        await ctx.reply(
          '⚙️ *Current Settings*\n\n' +
          `Timeout: ${settings.timeout} seconds\n` +
          `Auto Retry: ${settings.autoRetry ? 'Enabled' : 'Disabled'}\n` +
          `Cache: ${settings.cacheEnabled ? 'Enabled' : 'Disabled'}\n` +
          `Cache TTL: ${settings.cacheTTL} minutes\n\n` +
          'To change settings, use:\n' +
          '/settings timeout <seconds>\n' +
          '/settings retry <on/off>\n' +
          '/settings cache <on/off>\n' +
          '/settings ttl <minutes>',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching settings: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Domains command - list and manage whitelisted domains
    this.bot.command('domains', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Domain management not available');
        return;
      }
      
      try {
        const domains = await storageInstance.getAllDomains();
        
        if (domains.length === 0) {
          await ctx.reply(
            '🌐 *Whitelisted Domains*\n\n' +
            'No domains have been added yet.\n\n' +
            'Commands:\n' +
            '/domains add <domain> - Add a new domain\n' +
            '/domains list - List all domains',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const domainsText = domains.map(d => 
          `${d.id}. ${d.domain} - ${d.active ? '✅ Active' : '❌ Inactive'}`
        ).join('\n');
        
        await ctx.reply(
          '🌐 *Whitelisted Domains*\n\n' +
          `${domainsText}\n\n` +
          'Commands:\n' +
          '/domains add <domain> - Add a new domain\n' +
          '/domains toggle <id> - Toggle domain status\n' +
          '/domains delete <id> - Delete a domain',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching domains: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Cache command - manage video cache
    this.bot.command('cache', async (ctx) => {
      if (!videoScraperInstance || !storageInstance) {
        await ctx.reply('⚠️ Cache management not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        const videos = await storageInstance.getRecentVideos(5); // Get 5 most recent videos
        
        let videosText = '';
        if (videos.length > 0) {
          videosText = '\n\n*Recent Videos in Cache:*\n' + 
            videos.map(v => `- ${v.videoId}: ${v.title || 'Untitled'}`).join('\n');
        }
        
        await ctx.reply(
          '🗄️ *Video Cache*\n\n' +
          `Status: ${settings.cacheEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `TTL: ${settings.cacheTTL} minutes\n` +
          `${videosText}\n\n` +
          'Commands:\n' +
          '/cache clear - Clear the entire cache\n' +
          '/cache refresh <videoId> - Refresh a specific video\n' +
          '/settings cache on/off - Enable/disable cache',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching cache info: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Logs command - view system logs
    this.bot.command('logs', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Logs not available');
        return;
      }
      
      try {
        const { logs } = await storageInstance.getLogs(10, 0); // Get 10 most recent logs
        
        if (logs.length === 0) {
          await ctx.reply(
            '📝 *System Logs*\n\n' +
            'No logs available.\n\n' +
            'Commands:\n' +
            '/logs clear - Clear all logs',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const logsText = logs.map(log => 
          `[${log.level}] ${log.source}: ${log.message.substring(0, 50)}${log.message.length > 50 ? '...' : ''}`
        ).join('\n');
        
        await ctx.reply(
          '📝 *System Logs*\n\n' +
          `${logsText}\n\n` +
          'Commands:\n' +
          '/logs clear - Clear all logs',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '❓ *Help Information*\n\n' +
        'This bot allows you to manage your Video Scraper service.\n\n' +
        '*Commands:*\n' +
        '/menu - Show main menu\n' +
        '/stats - Show system statistics\n' +
        '/settings - Show and change settings\n' +
        '/domains - Manage whitelisted domains\n' +
        '/cache - Manage video cache\n' +
        '/logs - View recent logs\n' +
        '/channel - Configure channel storage\n\n' +
        '*Channel Storage:*\n' +
        'The bot can use a Telegram channel as database backup.\n' +
        'Use /channel to configure this feature.\n\n' +
        '*Admin Authentication:*\n' +
        'Use /admin <password> to authenticate as admin.',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Channel command - configures channel storage
    this.bot.command('channel', async (ctx) => {
      const channelStatus = this.isChannelStorageEnabled() 
        ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
        : '❌ Disabled';
      
      await ctx.reply(
        '📢 *Channel Storage*\n\n' +
        `Status: ${channelStatus}\n\n` +
        'Commands:\n' +
        '/channel enable <channelId> - Enable channel storage\n' +
        '/channel disable - Disable channel storage\n' +
        '/channel status - Show current status',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Process command arguments for settings, channel, etc.
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Handle settings command with arguments
      if (text.startsWith('/settings ')) {
        const args = text.split(' ');
        if (args.length >= 3) {
          const setting = args[1].toLowerCase();
          const value = args[2].toLowerCase();
          
          try {
            const currentSettings = await storageInstance?.getScraperSettings();
            if (!currentSettings) {
              await ctx.reply('⚠️ Failed to get current settings');
              return;
            }
            
            let updatedSettings: Partial<ScraperSettings> = {};
            
            if (setting === 'timeout' && !isNaN(parseInt(value))) {
              updatedSettings.timeout = parseInt(value);
            } else if (setting === 'retry') {
              updatedSettings.autoRetry = (value === 'on' || value === 'true');
            } else if (setting === 'cache') {
              updatedSettings.cacheEnabled = (value === 'on' || value === 'true');
            } else if (setting === 'ttl' && !isNaN(parseInt(value))) {
              updatedSettings.cacheTTL = parseInt(value);
            } else {
              await ctx.reply('⚠️ Invalid setting or value format');
              return;
            }
            
            const newSettings = await storageInstance?.updateScraperSettings(updatedSettings);
            await ctx.reply(`✅ Settings updated successfully:\n${JSON.stringify(newSettings, null, 2)}`);
          } catch (error) {
            await ctx.reply(`⚠️ Error updating settings: ${error instanceof Error ? error.message : String(error)}`);
          }
          return;
        }
      }
      
      // Handle channel command with arguments
      if (text.startsWith('/channel ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'enable' && args.length >= 3) {
            const channelId = args[2];
            this.enableChannelStorage(channelId);
            await ctx.reply(`✅ Channel storage enabled with ID: ${channelId}`);
            return;
          } else if (action === 'disable') {
            this.disableChannelStorage();
            await ctx.reply('✅ Channel storage disabled');
            return;
          } else if (action === 'status') {
            const status = this.isChannelStorageEnabled() 
              ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
              : '❌ Disabled';
            await ctx.reply(`Channel storage status: ${status}`);
            return;
          }
        }
      }
      
      // Handle admin authentication
      if (text.startsWith('/admin ')) {
        const password = text.split(' ')[1];
        if (this.verifyAdminPassword(password)) {
          this.adminUsers.add(ctx.from.id);
          await ctx.reply('✅ Admin access granted');
        } else {
          await ctx.reply('❌ Invalid admin password');
        }
        return;
      }
      
      // Handle domains command with arguments
      if (text.startsWith('/domains ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'add' && args.length >= 3) {
            // Add domain
            const domain = args.slice(2).join(' ').trim();
            
            try {
              const newDomain = await storageInstance?.createDomain({
                domain,
                active: true
              });
              
              await ctx.reply(`✅ Domain added successfully: ${domain}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error adding domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'toggle' && args.length >= 3) {
            // Toggle domain status
            const id = parseInt(args[2]);
            if (isNaN(id)) {
              await ctx.reply('⚠️ Invalid domain ID');
              return;
            }
            
            try {
              const updatedDomain = await storageInstance?.toggleDomainStatus(id);
              if (!updatedDomain) {
                await ctx.reply(`⚠️ Domain with ID ${id} not found`);
                return;
              }
              
              await ctx.reply(`✅ Domain ${id} is now ${updatedDomain.active ? 'active' : 'inactive'}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error toggling domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'delete' && args.length >= 3) {
            // Delete domain
            const id = parseInt(args[2]);
            if (isNaN(id)) {
              await ctx.reply('⚠️ Invalid domain ID');
              return;
            }
            
            try {
              const success = await storageInstance?.deleteDomain(id);
              if (!success) {
                await ctx.reply(`⚠️ Domain with ID ${id} not found`);
                return;
              }
              
              await ctx.reply(`✅ Domain ${id} deleted successfully`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error deleting domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'list') {
            // Trigger the /domains command to show the list
            if (this.bot) {
              await this.bot.handleUpdate({
                update_id: 0,
                message: {
                  message_id: 0,
                  date: 0,
                  chat: ctx.chat,
                  from: ctx.from,
                  text: '/domains'
                }
              });
            } else {
              await ctx.reply('⚠️ Cannot list domains: Bot instance not available');
            }
            return;
          }
        }
      }
      
      // Handle cache command with arguments
      if (text.startsWith('/cache ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'clear') {
            // Clear the entire cache
            try {
              await videoScraperInstance?.clearCache();
              
              await ctx.reply('✅ Cache cleared successfully');
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error clearing cache: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'refresh' && args.length >= 3) {
            // Refresh a specific video
            const videoId = args[2];
            
            try {
              const refreshedVideo = await videoScraperInstance?.refreshCache(videoId);
              
              if (!refreshedVideo) {
                await ctx.reply(`⚠️ Failed to refresh video: ${videoId}`);
                return;
              }
              
              await ctx.reply(`✅ Video refreshed successfully: ${videoId}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error refreshing video: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          }
        }
      }
      
      // Handle logs command with arguments
      if (text.startsWith('/logs ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'clear') {
            // Clear all logs
            try {
              await storageInstance?.clearLogs();
              
              await ctx.reply('✅ Logs cleared successfully');
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error clearing logs: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          }
        }
      }
      
      // Fallback for unrecognized commands
      if (text.startsWith('/') && 
          !['/start', '/menu', '/stats', '/settings', '/domains', '/cache', '/logs', '/channel', '/help', '/admin']
            .some(cmd => text.startsWith(cmd))) {
        await ctx.reply(
          '⚠️ Unknown command. Use /menu to see available commands.',
          {
            reply_markup: {
              keyboard: [[{ text: '/menu' }]],
              resize_keyboard: true
            }
          }
        );
      }
    });
  }
  
  /**
   * Check if user ID is in admin list
   */
  private isAdminUser(userId: number): boolean {
    return this.adminUsers.has(userId);
  }
  
  /**
   * Verify admin password
   */
  private verifyAdminPassword(password: string): boolean {
    const adminPassword = process.env.TELEGRAM_ADMIN_PASSWORD;
    return !!adminPassword && password === adminPassword;
  }
  
  /**
   * Start the bot
   */
  async start() {
    try {
      // If already running, just return
      if (this.isRunning) {
        console.log('Telegram bot is already running');
        return;
      }
      
      // If we have an existing bot instance, stop it first to avoid conflicts
      if (this.bot) {
        try {
          await this.bot.stop();
          console.log('Stopped existing Telegram bot instance');
        } catch (stopError) {
          console.warn('Could not stop existing bot instance:', stopError);
        }
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Initialize or re-initialize the bot
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token.length < 10) {
        console.log('No valid Telegram bot token found');
        return;
      }
      
      this.initializeBot(token);
      
      if (!this.bot) {
        throw new Error('Failed to initialize bot');
      }
      
      // Try to launch the bot with retry logic for conflict errors
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Determine if we're running in a VPS/cloud environment 
          // This detects Koyeb/Cloudflare/similar serverless environments
          const isServerlessEnv = process.env.KOYEB_APP_NAME || 
                                 process.env.CF_PAGES || 
                                 process.env.VERCEL || 
                                 process.env.NETLIFY;
          
          // Use webhook mode in cloud/VPS environments, polling in development
          if (isServerlessEnv) {
            // For webhook mode, we need a public URL
            const webhookDomain = process.env.PUBLIC_URL || process.env.APP_URL;
            
            if (webhookDomain) {
              const webhookUrl = `${webhookDomain}/api/telegram-webhook`;
              console.log(`Starting Telegram bot in webhook mode: ${webhookUrl}`);
              
              // Set webhook and launch in webhook mode
              await this.bot.telegram.setWebhook(webhookUrl);
              
              // For webhook mode, we'll handle the updates through the Express route
              console.log('Webhook set successfully, waiting for updates via HTTP endpoint');
            } else {
              console.log('No webhook domain found, falling back to polling mode');
              await this.bot.launch({
                dropPendingUpdates: true
              });
            }
          } else {
            // Standard polling mode for development
            console.log('Starting Telegram bot in polling mode');
            await this.bot.launch({
              dropPendingUpdates: true
            });
          }
          
          this.isRunning = true;
          console.log('Telegram bot started successfully');
          
          if (storageInstance) {
            storageInstance.createLog({
              level: 'INFO',
              source: 'Telegram',
              message: 'Telegram bot started'
            });
          }
          
          // If channel ID is set, enable storage
          if (this.channelStorage.channelId) {
            this.enableChannelStorage(this.channelStorage.channelId);
            console.log(`Channel storage enabled with ID: ${this.channelStorage.channelId}`);
          }
          
          return;
        } catch (launchError) {
          retryCount++;
          
          // Check if this is a conflict error
          const isConflictError = 
            typeof launchError === 'object' && 
            launchError !== null && 
            'message' in launchError && 
            typeof launchError.message === 'string' && 
            (launchError.message.includes('Conflict') || 
             launchError.message.includes('409'));
          
          if (isConflictError && retryCount < maxRetries) {
            console.log(`Bot conflict detected (attempt ${retryCount}/${maxRetries}), waiting before retry...`);
            
            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          } else {
            // For non-conflict errors or if we've reached max retries, log and throw
            throw launchError;
          }
        }
      }
      
      throw new Error(`Failed to start bot after ${maxRetries} retries`);
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
      this.isRunning = false;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }
  
  /**
   * Stop the bot
   */
  async stop() {
    if (!this.bot || !this.isRunning) return;
    
    try {
      this.bot.stop();
      this.isRunning = false;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Telegram bot stopped'
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to stop Telegram bot:', error);
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to stop Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      return false;
    }
  }
  
  /**
   * Check if the bot is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get the bot instance for direct access (e.g., webhook handling)
   */
  getBot(): Telegraf | null {
    return this.bot;
  }
  
  /**
   * Enable Telegram channel as database storage
   */
  enableChannelStorage(channelId?: string): void {
    if (channelId) {
      this.channelStorage.channelId = channelId;
    }
    
    this.channelStorage.enabled = true;
  }
  
  /**
   * Disable Telegram channel as database storage
   */
  disableChannelStorage(): void {
    this.channelStorage.enabled = false;
  }
  
  /**
   * Save data to Telegram channel
   * This method serializes data to JSON and sends it as a message to the configured Telegram channel
   */
  async saveToChannel<T>(key: string, data: T): Promise<boolean> {
    // Completely disabled for now to prevent recurring errors
    console.log('Telegram channel storage is completely disabled - not saving data for key:', key);
    return false;
    
    /* Original implementation disabled
    if (!this.bot || !this.isRunning || !this.isChannelStorageEnabled() || !this.channelStorage.channelId) {
      return false;
    }
    
    try {
      const messageText = `DATA:${key}\n${JSON.stringify(data, null, 2)}`;
      
      // Use sendMessage directly to the channel
      await this.bot.telegram.sendMessage(this.channelStorage.channelId, messageText);
      
      return true;
    } catch (error) {
      console.error(`Failed to save data to Telegram channel: ${error instanceof Error ? error.message : String(error)}`);
      
      // Disable channel storage after consistent failures
      if (error instanceof Error && error.message && 
          (error.message.includes('chat not found') || error.message.includes('Bad Request'))) {
        console.log('Disabling Telegram channel storage due to persistent errors');
        this.disableChannelStorage();
      }
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to save data to channel: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      return false;
    }
    */
  }
  
  /**
   * Save a video to the Telegram channel
   */
  async saveVideo(video: Video): Promise<boolean> {
    return this.saveToChannel(`video:${video.videoId}`, video);
  }
  
  /**
   * Save a domain to the Telegram channel
   */
  async saveDomain(domain: Domain): Promise<boolean> {
    return this.saveToChannel(`domain:${domain.id}`, domain);
  }
  
  /**
   * Save a log to the Telegram channel
   */
  async saveLog(log: Log): Promise<boolean> {
    return this.saveToChannel(`log:${log.id}`, log);
  }
  
  /**
   * Save settings to the Telegram channel
   */
  async saveSettings(settings: ScraperSettings): Promise<boolean> {
    return this.saveToChannel('settings', settings);
  }
  
  /**
   * Check if channel storage is enabled
   */
  isChannelStorageEnabled(): boolean {
    return !!this.channelStorage.enabled && !!this.channelStorage.channelId;
  }
}

export const telegramBot = new TelegramBot();