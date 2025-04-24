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
        await ctx.reply(`⚠️ Error fetching settings: ${error.message}`);
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
    
    // Fallback for unrecognized commands
    this.bot.on('message', async (ctx) => {
      if ('text' in ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
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
    return adminPassword && password === adminPassword;
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
          // Use dropPendingUpdates to avoid processing old messages after restart
          await this.bot.launch({
            dropPendingUpdates: true
          });
          
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
            launchError.message && 
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