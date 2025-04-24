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
   * Start the bot
   */
  async start() {
    try {
      if (!this.bot) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token && token.length > 10) {
          this.initializeBot(token);
        } else {
          console.log('No valid Telegram bot token found');
          return;
        }
      }
      
      if (this.isRunning || !this.bot) {
        return;
      }
      
      await this.bot.launch();
      this.isRunning = true;
      console.log('Telegram bot started successfully');
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Telegram bot started'
        });
      }
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
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
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to save data to channel: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      return false;
    }
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
    return this.channelStorage.enabled && !!this.channelStorage.channelId;
  }
}

export const telegramBot = new TelegramBot();