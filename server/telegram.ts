import { Telegraf, Context } from 'telegraf';
import { storage } from './storage';
import { videoScraper } from './scraper';
import { Domain, Video, Log, ScraperSettings } from '@shared/schema';

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
    enabled: false
  };
  
  constructor() {
    // Initialize the bot if token is provided
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.initializeBot(token);
    }
  }
  
  private initializeBot(token: string) {
    try {
      this.bot = new Telegraf(token);
      this.setupCommands();
      
      storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: 'Telegram bot initialized'
      });
    } catch (error) {
      storage.createLog({
        level: 'ERROR',
        source: 'Telegram',
        message: `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  private setupCommands() {
    if (!this.bot) return;
    
    // Start command
    this.bot.start(async (ctx) => {
      const userId = ctx.from.id;
      await ctx.reply('Welcome to VideoScraperX Bot! Use /help to see available commands.');
      
      storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: `User ${userId} started the bot`
      });
    });
    
    // Help command
    this.bot.help(async (ctx) => {
      await ctx.reply(
        'Available commands:\n' +
        '/auth [password] - Authenticate as admin\n' +
        '/status - Check system status\n' +
        '/scrape [videoId] - Scrape a video\n' +
        '/clear_cache - Clear the entire cache\n' +
        '/domains - List whitelisted domains\n' +
        '/add_domain [domain] - Add a domain to whitelist\n' +
        '/restart - Restart the scraper\n' +
        '/channel_enable [channelId] - Enable Telegram channel storage\n' +
        '/channel_disable - Disable Telegram channel storage\n' +
        '/channel_status - Check Telegram channel storage status'
      );
    });
    
    // Auth command to authenticate as admin
    this.bot.command('auth', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const password = args[1];
      const userId = ctx.from.id;
      
      if (!password) {
        await ctx.reply('Please provide a password: /auth [password]');
        return;
      }
      
      // Simple password check (in production, this would be more secure)
      if (password === 'admin123') {
        this.adminUsers.add(userId);
        await ctx.reply('Successfully authenticated as admin!');
        
        storage.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: `User ${userId} authenticated as admin`
        });
      } else {
        await ctx.reply('Invalid password!');
      }
    });
    
    // Check if user is admin
    const requireAdmin = async (ctx: any, next: () => Promise<void>) => {
      const userId = ctx.from.id;
      if (!this.adminUsers.has(userId)) {
        await ctx.reply('You need to be an admin to use this command. Use /auth [password] to authenticate.');
        return;
      }
      return next();
    };
    
    // Status command
    this.bot.command('status', requireAdmin, async (ctx) => {
      const settings = await storage.getScraperSettings();
      await ctx.reply(
        '📊 System Status\n' +
        '------------------------\n' +
        `🟢 Scraper: Running\n` +
        `🟢 Cache: ${settings.cacheEnabled ? 'Enabled' : 'Disabled'}\n` +
        `⏱️ Timeout: ${settings.timeout} seconds\n` +
        `🔄 Auto Retry: ${settings.autoRetry ? 'Enabled' : 'Disabled'}\n` +
        `⏳ Cache TTL: ${settings.cacheTTL} seconds`
      );
    });
    
    // Scrape command
    this.bot.command('scrape', requireAdmin, async (ctx) => {
      const args = ctx.message.text.split(' ');
      const videoId = args[1];
      
      if (!videoId) {
        await ctx.reply('Please provide a video ID: /scrape [videoId]');
        return;
      }
      
      try {
        await ctx.reply(`🔄 Scraping video ID: ${videoId}...`);
        
        const video = await videoScraper.scrapeVideo(videoId);
        
        await ctx.reply(
          `✅ Successfully scraped video!\n\n` +
          `🎬 Title: ${video.title}\n` +
          `🆔 ID: ${video.videoId}\n` +
          `📊 Quality: ${video.quality}\n\n` +
          `🔗 URL: ${video.url}`
        );
        
        storage.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: `Video ID ${videoId} scraped via Telegram`
        });
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        
        storage.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to scrape video ID ${videoId}: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
    
    // Clear cache command
    this.bot.command('clear_cache', requireAdmin, async (ctx) => {
      await videoScraper.clearCache();
      await ctx.reply('✅ Cache cleared successfully!');
      
      storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: 'Cache cleared via Telegram'
      });
    });
    
    // List domains command
    this.bot.command('domains', requireAdmin, async (ctx) => {
      const domains = await storage.getAllDomains();
      
      if (domains.length === 0) {
        await ctx.reply('No domains in the whitelist.');
        return;
      }
      
      const domainList = domains.map(d => 
        `${d.active ? '🟢' : '🔴'} ${d.domain}`
      ).join('\n');
      
      await ctx.reply(
        '📋 Whitelisted Domains\n' +
        '------------------------\n' +
        domainList
      );
    });
    
    // Add domain command
    this.bot.command('add_domain', requireAdmin, async (ctx) => {
      const args = ctx.message.text.split(' ');
      const domain = args[1];
      
      if (!domain) {
        await ctx.reply('Please provide a domain: /add_domain [domain]');
        return;
      }
      
      try {
        await storage.createDomain({ domain, active: true });
        await ctx.reply(`✅ Domain "${domain}" added to whitelist!`);
        
        storage.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: `Domain ${domain} added via Telegram`
        });
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        
        storage.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to add domain ${domain}: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
    
    // Restart scraper command
    this.bot.command('restart', requireAdmin, async (ctx) => {
      await ctx.reply('🔄 Restarting scraper...');
      
      try {
        await videoScraper.closeBrowser();
        // The scraper will automatically reinitialize on next request
        
        await ctx.reply('✅ Scraper restarted successfully!');
        
        storage.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Scraper restarted via Telegram'
        });
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        
        storage.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to restart scraper: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
  }
  
  /**
   * Start the bot
   */
  async start() {
    if (!this.bot || this.isRunning) return;
    
    try {
      await this.bot.launch();
      this.isRunning = true;
      
      storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: 'Telegram bot started'
      });
    } catch (error) {
      storage.createLog({
        level: 'ERROR',
        source: 'Telegram',
        message: `Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  /**
   * Stop the bot
   */
  async stop() {
    if (!this.bot || !this.isRunning) return;
    
    try {
      await this.bot.stop();
      this.isRunning = false;
      
      storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: 'Telegram bot stopped'
      });
    } catch (error) {
      storage.createLog({
        level: 'ERROR',
        source: 'Telegram',
        message: `Failed to stop Telegram bot: ${error instanceof Error ? error.message : String(error)}`
      });
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
    
    if (!this.channelStorage.channelId) {
      throw new Error('Telegram channel ID is not set. Set TELEGRAM_CHANNEL_ID environment variable or pass channelId parameter.');
    }
    
    this.channelStorage.enabled = true;
    
    storage.createLog({
      level: 'INFO',
      source: 'Telegram',
      message: `Telegram channel storage enabled for channel: ${this.channelStorage.channelId}`
    });
  }
  
  /**
   * Disable Telegram channel as database storage
   */
  disableChannelStorage(): void {
    this.channelStorage.enabled = false;
    
    storage.createLog({
      level: 'INFO',
      source: 'Telegram',
      message: 'Telegram channel storage disabled'
    });
  }
  
  /**
   * Save data to Telegram channel
   * This method serializes data to JSON and sends it as a message to the configured Telegram channel
   */
  async saveToChannel<T>(key: string, data: T): Promise<boolean> {
    if (!this.bot || !this.isRunning || !this.channelStorage.enabled || !this.channelStorage.channelId) {
      return false;
    }
    
    try {
      // Create a JSON representation of the data with metadata
      const payload = {
        key,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Serialize to JSON
      const message = `#${key}\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
      
      // Send to channel
      await this.bot.telegram.sendMessage(this.channelStorage.channelId, message, { parse_mode: 'Markdown' });
      
      return true;
    } catch (error) {
      storage.createLog({
        level: 'ERROR',
        source: 'Telegram',
        message: `Failed to save data to Telegram channel: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return false;
    }
  }
  
  /**
   * Save a video to the Telegram channel
   */
  async saveVideo(video: Video): Promise<boolean> {
    return this.saveToChannel(`video_${video.videoId}`, video);
  }
  
  /**
   * Save a domain to the Telegram channel
   */
  async saveDomain(domain: Domain): Promise<boolean> {
    return this.saveToChannel(`domain_${domain.id}`, domain);
  }
  
  /**
   * Save a log to the Telegram channel
   */
  async saveLog(log: Log): Promise<boolean> {
    return this.saveToChannel(`log_${log.id}`, log);
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
    return this.channelStorage.enabled && !!this.channelStorage.channelId;
  }
}

// Export singleton instance
export const telegramBot = new TelegramBot();
