import { 
  users, videos, domains, logs,
  type User, type InsertUser,
  type Video, type InsertVideo,
  type Domain, type InsertDomain,
  type Log, type InsertLog,
  type ScraperSettings
} from "@shared/schema";

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
      ...insertVideo, 
      id, 
      scrapedAt: now, 
      lastAccessed: now, 
      accessCount: 0 
    };
    this.videos.set(id, video);
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
    return updatedVideo;
  }
  
  async incrementAccessCount(videoId: string): Promise<void> {
    const video = await this.getVideoByVideoId(videoId);
    if (!video) return;
    
    const updatedVideo = { 
      ...video, 
      accessCount: video.accessCount + 1,
      lastAccessed: new Date()
    };
    
    this.videos.set(video.id, updatedVideo);
  }
  
  async getRecentVideos(limit: number): Promise<Video[]> {
    return Array.from(this.videos.values())
      .sort((a, b) => {
        return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
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
      ...insertDomain, 
      id, 
      addedAt: new Date() 
    };
    this.domains.set(id, domain);
    return domain;
  }
  
  async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    const domain = this.domains.get(id);
    if (!domain) return undefined;
    
    const updatedDomain = { ...domain, active: !domain.active };
    this.domains.set(id, updatedDomain);
    return updatedDomain;
  }
  
  async deleteDomain(id: number): Promise<boolean> {
    return this.domains.delete(id);
  }
  
  async isDomainWhitelisted(domain: string): Promise<boolean> {
    const activeDomains = await this.getActiveDomains();
    return activeDomains.some(d => d.domain === domain);
  }
  
  // Log methods
  async getLogs(limit: number, offset: number, level?: string): Promise<{ logs: Log[], total: number }> {
    let logs = Array.from(this.logs.values())
      .sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
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
    return this.scraperSettings;
  }
}

export const storage = new MemStorage();
