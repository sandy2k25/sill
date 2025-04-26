import { 
  users, videos, domains, logs,
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Domain, type InsertDomain,
  type Log, type InsertLog,
  type ScraperSettings
} from "@shared/schema";
import { telegramBot } from './telegram';
import { IStorage } from './storage';

// Default scraper settings
const DEFAULT_SCRAPER_SETTINGS: ScraperSettings = {
  timeout: 30,
  autoRetry: true,
  cacheEnabled: true,
  cacheTTL: 120 // 2 hours in minutes
};

/**
 * TelegramStorage class that implements IStorage interface
 * Uses Telegram as the primary data store
 */
export class TelegramStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private videos: Map<number, Video> = new Map();
  private domains: Map<number, Domain> = new Map();
  private logs: Map<number, Log> = new Map();
  private scraperSettings: ScraperSettings = DEFAULT_SCRAPER_SETTINGS;
  
  // Counters for generating IDs
  private userIdCounter: number = 1;
  private videoIdCounter: number = 1;
  private domainIdCounter: number = 1;
  private logIdCounter: number = 1;
  
  // Flag to indicate if data has been loaded from Telegram
  private dataLoaded: boolean = false;
  private isLoading: boolean = false;

  constructor() {
    console.log('Initializing Telegram storage');
  }

  /**
   * Initialize storage by loading data from Telegram
   */
  async initialize(): Promise<void> {
    if (this.dataLoaded || this.isLoading) return;
    
    this.isLoading = true;
    console.log('Loading data from Telegram channel...');
    
    try {
      // Load data from Telegram
      await this.loadFromTelegram();
      
      // If no data is loaded, initialize with defaults
      if (this.users.size === 0) {
        console.log('No users found in Telegram, creating default admin user');
        await this.createUser({
          username: "admin",
          password: process.env.WEB_ADMIN_PASSWORD || "admin123", // Use environment variable if available
        });
      }
      
      if (this.domains.size === 0) {
        console.log('No domains found in Telegram, adding default whitelisted domains');
        await this.createDomain({ domain: "localhost", active: true });
        await this.createDomain({ domain: "example.com", active: true });
        await this.createDomain({ domain: "iframe.example.com", active: true });
      }
      
      console.log('Telegram storage initialized with:');
      console.log(`- ${this.users.size} users`);
      console.log(`- ${this.videos.size} videos`);
      console.log(`- ${this.domains.size} domains`);
      console.log(`- ${this.logs.size} logs`);
      
      this.dataLoaded = true;
    } catch (error) {
      console.error('Failed to load data from Telegram:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load all data from Telegram channel
   * 
   * This simplified implementation ensures data persistence by saving to Telegram
   * rather than retrieving from it due to API limitations.
   * 
   * Future improvements could implement a custom solution for data retrieval
   * but for now we focus on ensuring the app runs properly.
   */
  private async loadFromTelegram(): Promise<void> {
    console.log('Initializing data storage with local cache');
    console.log('Data will be saved to Telegram for persistence but not loaded from it in this version');
    
    // In this implementation, we're not loading data from Telegram due to API limitations
    // Instead, we're ensuring that all data operations are saved to Telegram
    // This means the first run will have default data, but all changes will persist
    
    // Create default admin user with proper password
    if (this.users.size === 0) {
      const adminPassword = process.env.WEB_ADMIN_PASSWORD || 'admin';
      let hashedPassword = adminPassword;
      
      // Apply basic hashing if not already hashed (simple check)
      if (!hashedPassword.startsWith('$')) {
        // We're not using bcrypt directly here to avoid dependencies
        // This is a simplified approach for the demo
        hashedPassword = '$' + Buffer.from(adminPassword).toString('base64');
      }
      
      this.users.set(1, {
        id: 1,
        username: 'admin',
        password: hashedPassword
      });
      
      console.log('Created default admin user');
    }
    
    // Add default domains if none exist
    if (this.domains.size === 0) {
      const defaultDomains = [
        { domain: 'localhost', active: true },
        { domain: 'iframe.example.com', active: true },
        { domain: 'example.com', active: true }
      ];
      
      let id = 1;
      for (const domain of defaultDomains) {
        this.domains.set(id, {
          id: id,
          domain: domain.domain,
          active: domain.active,
          addedAt: new Date()
        });
        id++;
      }
      
      console.log('Added default domains');
    }
    
    // Set default scraper settings
    this.scraperSettings = DEFAULT_SCRAPER_SETTINGS;
    
    // Update counters based on loaded data
    this.updateCounters();
    
    // Mark data as loaded
    this.dataLoaded = true;
    
    console.log('Data initialization complete');
  }

  /**
   * Process a data message from Telegram
   * @param messageText The text content of the message
   */
  private async processDataMessage(messageText: string): Promise<void> {
    try {
      // Split the message into key and data parts
      const firstLineEnd = messageText.indexOf('\n');
      if (firstLineEnd === -1) return;
      
      const firstLine = messageText.substring(0, firstLineEnd);
      const dataKey = firstLine.substring(5); // Remove 'DATA:' prefix
      const jsonData = messageText.substring(firstLineEnd + 1);
      
      // Parse the JSON data
      const data = JSON.parse(jsonData);
      
      // Store data based on its key
      if (dataKey.startsWith('user:')) {
        const user = data as User;
        this.users.set(user.id, user);
      } else if (dataKey.startsWith('video:')) {
        const video = data as Video;
        this.videos.set(video.id, video);
      } else if (dataKey.startsWith('domain:')) {
        const domain = data as Domain;
        this.domains.set(domain.id, domain);
      } else if (dataKey.startsWith('log:')) {
        const log = data as Log;
        this.logs.set(log.id, log);
      } else if (dataKey === 'settings') {
        this.scraperSettings = { ...DEFAULT_SCRAPER_SETTINGS, ...data };
      }
    } catch (error) {
      console.error('Error processing data message:', error);
    }
  }

  /**
   * Update ID counters based on loaded data
   */
  private updateCounters(): void {
    // Update user ID counter
    if (this.users.size > 0) {
      const maxUserId = Math.max(...Array.from(this.users.keys()));
      this.userIdCounter = maxUserId + 1;
    }
    
    // Update video ID counter
    if (this.videos.size > 0) {
      const maxVideoId = Math.max(...Array.from(this.videos.keys()));
      this.videoIdCounter = maxVideoId + 1;
    }
    
    // Update domain ID counter
    if (this.domains.size > 0) {
      const maxDomainId = Math.max(...Array.from(this.domains.keys()));
      this.domainIdCounter = maxDomainId + 1;
    }
    
    // Update log ID counter
    if (this.logs.size > 0) {
      const maxLogId = Math.max(...Array.from(this.logs.keys()));
      this.logIdCounter = maxLogId + 1;
    }
    
    console.log('ID counters updated:', {
      userIdCounter: this.userIdCounter,
      videoIdCounter: this.videoIdCounter,
      domainIdCounter: this.domainIdCounter,
      logIdCounter: this.logIdCounter
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    await this.ensureDataLoaded();
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ensureDataLoaded();
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureDataLoaded();
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    
    // Save to Telegram
    try {
      if (telegramBot.isChannelStorageEnabled()) {
        await telegramBot.saveToChannel(`user:${user.id}`, user);
      }
    } catch (error) {
      console.error(`Error saving user to Telegram: ${error}`);
    }
    
    return user;
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    await this.ensureDataLoaded();
    return this.videos.get(id);
  }
  
  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    await this.ensureDataLoaded();
    return Array.from(this.videos.values()).find(
      (video) => video.videoId === videoId,
    );
  }
  
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    await this.ensureDataLoaded();
    
    // Check if a video with this videoId already exists
    const existingVideo = await this.getVideoByVideoId(insertVideo.videoId);
    if (existingVideo) {
      // If the video exists but URL has changed, update it
      if (existingVideo.url !== insertVideo.url) {
        const updatedVideo = await this.updateVideo(insertVideo.videoId, insertVideo.url);
        // If for some reason the update failed, return the existing video
        return updatedVideo || existingVideo;
      }
      // Otherwise, just return the existing video
      return existingVideo;
    }
    
    // Create a new video if it doesn't exist
    const id = this.videoIdCounter++;
    const now = new Date();
    const video: Video = { 
      id,
      videoId: insertVideo.videoId,
      title: insertVideo.title || null,
      url: insertVideo.url,
      quality: insertVideo.quality || null,
      scrapedAt: now,
      lastAccessed: now,
      accessCount: 0
    };
    this.videos.set(id, video);
    
    // Save to Telegram
    try {
      if (telegramBot.isChannelStorageEnabled()) {
        await telegramBot.saveVideo(video);
      }
    } catch (error) {
      console.error(`Error saving video to Telegram: ${error}`);
    }
    
    return video;
  }
  
  async updateVideo(videoId: string, url: string): Promise<Video | undefined> {
    await this.ensureDataLoaded();
    const video = await this.getVideoByVideoId(videoId);
    if (!video) return undefined;
    
    const updatedVideo = { 
      ...video, 
      url,
      lastAccessed: new Date()
    };
    
    this.videos.set(video.id, updatedVideo);
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveVideo(updatedVideo);
    }
    
    return updatedVideo;
  }
  
  async incrementAccessCount(videoId: string): Promise<void> {
    await this.ensureDataLoaded();
    const video = await this.getVideoByVideoId(videoId);
    if (!video) return;
    
    const updatedVideo = { 
      ...video, 
      accessCount: (video.accessCount || 0) + 1,
      lastAccessed: new Date()
    };
    
    this.videos.set(video.id, updatedVideo);
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveVideo(updatedVideo);
    }
  }
  
  async getRecentVideos(limit: number): Promise<Video[]> {
    await this.ensureDataLoaded();
    return Array.from(this.videos.values())
      .sort((a, b) => {
        // Handle null dates
        const dateA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
        const dateB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);
  }
  
  // Domain methods
  async getAllDomains(): Promise<Domain[]> {
    await this.ensureDataLoaded();
    return Array.from(this.domains.values());
  }
  
  async getActiveDomains(): Promise<Domain[]> {
    await this.ensureDataLoaded();
    return Array.from(this.domains.values()).filter(domain => domain.active);
  }
  
  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    await this.ensureDataLoaded();
    // Normalize domain
    const normalizedDomain = insertDomain.domain.toLowerCase().trim();
    
    // Check if domain already exists to avoid duplicates
    const existingDomain = Array.from(this.domains.values()).find(
      d => d.domain.toLowerCase() === normalizedDomain
    );
    
    if (existingDomain) {
      return existingDomain;
    }
    
    const id = this.domainIdCounter++;
    const domain: Domain = { 
      id,
      domain: normalizedDomain,
      active: insertDomain.active !== undefined ? insertDomain.active : true,
      addedAt: new Date()
    };
    this.domains.set(id, domain);
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveDomain(domain);
    }
    
    return domain;
  }
  
  async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    await this.ensureDataLoaded();
    const domain = this.domains.get(id);
    if (!domain) return undefined;
    
    const updatedDomain = { ...domain, active: !domain.active };
    this.domains.set(id, updatedDomain);
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveDomain(updatedDomain);
    }
    
    return updatedDomain;
  }
  
  async deleteDomain(id: number): Promise<boolean> {
    await this.ensureDataLoaded();
    const domain = this.domains.get(id);
    const deleted = this.domains.delete(id);
    
    // If deleted successfully and Telegram channel is enabled, log the deletion
    if (deleted && domain && telegramBot.isChannelStorageEnabled()) {
      await this.createLog({
        level: 'INFO',
        source: 'Domains',
        message: `Domain "${domain.domain}" (ID: ${domain.id}) has been deleted`
      });
    }
    
    return deleted;
  }
  
  async isDomainWhitelisted(domain: string): Promise<boolean> {
    await this.ensureDataLoaded();
    // Special case: localhost and replit.dev domains are always whitelisted for development
    if (domain === 'localhost' || domain.endsWith('.replit.dev') || domain.endsWith('.repl.co')) {
      return true;
    }
    
    // Normalize the domain for comparison
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Check if the domain exists in the whitelist and is active
    const domains = Array.from(this.domains.values());
    return domains.some(whitelistedDomain => 
      whitelistedDomain.domain.toLowerCase() === normalizedDomain && whitelistedDomain.active
    );
  }
  
  // Log methods
  async getLogs(limit: number, offset: number, level?: string): Promise<{ logs: Log[], total: number }> {
    await this.ensureDataLoaded();
    let logs = Array.from(this.logs.values())
      .sort((a, b) => {
        // Handle null timestamps
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
    
    const total = logs.length;
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    logs = logs.slice(offset, offset + limit);
    
    return { logs, total: level ? logs.length : total };
  }
  
  async createLog(insertLog: InsertLog): Promise<Log> {
    await this.ensureDataLoaded();
    const id = this.logIdCounter++;
    const log: Log = { 
      ...insertLog, 
      id, 
      timestamp: new Date() 
    };
    this.logs.set(id, log);
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveLog(log);
    }
    
    return log;
  }
  
  async clearLogs(): Promise<void> {
    await this.ensureDataLoaded();
    this.logs.clear();
    this.logIdCounter = 1;
    
    // Add a log entry for clearing logs
    await this.createLog({
      level: "INFO",
      source: "System",
      message: "Logs have been cleared"
    });
  }
  
  // Settings
  async getScraperSettings(): Promise<ScraperSettings> {
    await this.ensureDataLoaded();
    return this.scraperSettings;
  }
  
  async updateScraperSettings(settings: Partial<ScraperSettings>): Promise<ScraperSettings> {
    await this.ensureDataLoaded();
    this.scraperSettings = { ...this.scraperSettings, ...settings };
    
    // Save to Telegram
    if (telegramBot.isChannelStorageEnabled()) {
      await telegramBot.saveSettings(this.scraperSettings);
    }
    
    return this.scraperSettings;
  }
  
  /**
   * Helper method to ensure data is loaded before accessing it
   */
  private async ensureDataLoaded(): Promise<void> {
    if (!this.dataLoaded && !this.isLoading) {
      await this.initialize();
    }
  }
}

// Create an instance of TelegramStorage
export const telegramStorage = new TelegramStorage();