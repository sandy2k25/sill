import { 
  users, videos, domains, logs,
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Domain, type InsertDomain,
  type Log, type InsertLog,
  type ScraperSettings
} from "@shared/schema";
import { telegramBot } from './telegram';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Video methods
  getVideo(id: number): Promise<Video | undefined>;
  getVideoByVideoId(videoId: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(videoId: string, url: string): Promise<Video | undefined>;
  incrementAccessCount(videoId: string): Promise<void>;
  getRecentVideos(limit: number): Promise<Video[]>;
  
  // Domain methods
  getAllDomains(): Promise<Domain[]>;
  getActiveDomains(): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  toggleDomainStatus(id: number): Promise<Domain | undefined>;
  deleteDomain(id: number): Promise<boolean>;
  isDomainWhitelisted(domain: string): Promise<boolean>;
  
  // Log methods
  getLogs(limit: number, offset: number, level?: string): Promise<{ logs: Log[], total: number }>;
  createLog(log: InsertLog): Promise<Log>;
  clearLogs(): Promise<void>;
  
  // Settings
  getScraperSettings(): Promise<ScraperSettings>;
  updateScraperSettings(settings: Partial<ScraperSettings>): Promise<ScraperSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private videos: Map<number, Video>;
  private domains: Map<number, Domain>;
  private logs: Map<number, Log>;
  private scraperSettings: ScraperSettings;
  
  // Counters for generating IDs
  private userIdCounter: number;
  private videoIdCounter: number;
  private domainIdCounter: number;
  private logIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.domains = new Map();
    this.logs = new Map();
    
    this.userIdCounter = 1;
    this.videoIdCounter = 1;
    this.domainIdCounter = 1;
    this.logIdCounter = 1;
    
    // Initialize with default scraper settings
    this.scraperSettings = {
      timeout: 30,
      autoRetry: true,
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour in seconds
    };
    
    // Add a default admin user
    this.createUser({
      username: "admin",
      password: "admin123", // In production, this would be hashed
    });
    
    // Add some default whitelisted domains
    this.createDomain({ domain: "example.com", active: true });
    this.createDomain({ domain: "localhost", active: true });
    
    // Add initial log
    this.createLog({
      level: "INFO",
      source: "System",
      message: "Application started successfully"
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    return this.videos.get(id);
  }
  
  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    return Array.from(this.videos.values()).find(
      (video) => video.videoId === videoId,
    );
  }
  
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
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
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveVideo(video).catch(error => {
        console.error('Failed to save video to Telegram channel:', error);
      });
    }
    
    return video;
  }
  
  async updateVideo(videoId: string, url: string): Promise<Video | undefined> {
    const video = await this.getVideoByVideoId(videoId);
    if (!video) return undefined;
    
    const updatedVideo = { 
      ...video, 
      url,
      lastAccessed: new Date()
    };
    
    this.videos.set(video.id, updatedVideo);
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveVideo(updatedVideo).catch(error => {
        console.error('Failed to save updated video to Telegram channel:', error);
      });
    }
    
    return updatedVideo;
  }
  
  async incrementAccessCount(videoId: string): Promise<void> {
    const video = await this.getVideoByVideoId(videoId);
    if (!video) return;
    
    const updatedVideo = { 
      ...video, 
      accessCount: (video.accessCount || 0) + 1,
      lastAccessed: new Date()
    };
    
    this.videos.set(video.id, updatedVideo);
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveVideo(updatedVideo).catch(error => {
        console.error('Failed to save video access count to Telegram channel:', error);
      });
    }
  }
  
  async getRecentVideos(limit: number): Promise<Video[]> {
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
    return Array.from(this.domains.values());
  }
  
  async getActiveDomains(): Promise<Domain[]> {
    return Array.from(this.domains.values()).filter(domain => domain.active);
  }
  
  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    const id = this.domainIdCounter++;
    const domain: Domain = { 
      id,
      domain: insertDomain.domain,
      active: insertDomain.active !== undefined ? insertDomain.active : true,
      addedAt: new Date()
    };
    this.domains.set(id, domain);
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveDomain(domain).catch(error => {
        console.error('Failed to save domain to Telegram channel:', error);
      });
    }
    
    return domain;
  }
  
  async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    const domain = this.domains.get(id);
    if (!domain) return undefined;
    
    const updatedDomain = { ...domain, active: !domain.active };
    this.domains.set(id, updatedDomain);
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveDomain(updatedDomain).catch(error => {
        console.error('Failed to save updated domain to Telegram channel:', error);
      });
    }
    
    return updatedDomain;
  }
  
  async deleteDomain(id: number): Promise<boolean> {
    const domain = this.domains.get(id);
    const deleted = this.domains.delete(id);
    
    // If deleted successfully and Telegram channel is enabled, log the deletion
    if (deleted && domain && telegramBot.isChannelStorageEnabled()) {
      this.createLog({
        level: 'INFO',
        source: 'Domains',
        message: `Domain "${domain.domain}" (ID: ${domain.id}) has been deleted`
      });
    }
    
    return deleted;
  }
  
  async isDomainWhitelisted(domain: string): Promise<boolean> {
    // Special case: localhost and replit.dev domains are always whitelisted for development
    if (domain === 'localhost' || domain.endsWith('.replit.dev') || domain.endsWith('.repl.co')) {
      return true;
    }

    // Check if the domain exists in the whitelist and is active
    const domains = Array.from(this.domains.values());
    return domains.some(whitelistedDomain => 
      whitelistedDomain.domain === domain && whitelistedDomain.active
    );
  }
  
  // Log methods
  async getLogs(limit: number, offset: number, level?: string): Promise<{ logs: Log[], total: number }> {
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
    
    return { logs, total };
  }
  
  async createLog(insertLog: InsertLog): Promise<Log> {
    const id = this.logIdCounter++;
    const log: Log = { 
      ...insertLog, 
      id, 
      timestamp: new Date() 
    };
    this.logs.set(id, log);
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveLog(log).catch(error => {
        console.error('Failed to save log to Telegram channel:', error);
      });
    }
    
    return log;
  }
  
  async clearLogs(): Promise<void> {
    this.logs.clear();
    this.logIdCounter = 1;
    
    // Add a log entry for clearing logs
    this.createLog({
      level: "INFO",
      source: "System",
      message: "Logs have been cleared"
    });
  }
  
  // Settings
  async getScraperSettings(): Promise<ScraperSettings> {
    return this.scraperSettings;
  }
  
  async updateScraperSettings(settings: Partial<ScraperSettings>): Promise<ScraperSettings> {
    this.scraperSettings = { ...this.scraperSettings, ...settings };
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveSettings(this.scraperSettings).catch(error => {
        console.error('Failed to save settings to Telegram channel:', error);
      });
    }
    
    return this.scraperSettings;
  }
}

// Use Telegram storage as the primary database
import { telegramStorage } from './telegramStorage';
export const storage = telegramStorage;
