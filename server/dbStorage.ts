import { eq, desc, asc, and, like, sql } from 'drizzle-orm';
import { db } from './db';
import { 
  users, domains, videos, logs, 
  type User, type Domain, type Video, type Log,
  type InsertUser, type InsertDomain, type InsertVideo, type InsertLog
} from '@shared/schema';
import { telegramBot } from './telegram';
import { videoScraper } from './scraper';

// Default scraper settings
const DEFAULT_SCRAPER_SETTINGS = {
  timeout: 30,
  autoRetry: true,
  cacheEnabled: true,
  cacheTTL: 120 // 2 hours in minutes
};

export class DatabaseStorage {
  private scraperSettings = DEFAULT_SCRAPER_SETTINGS;

  constructor() {
    console.log('Initializing database storage');
    // Initialize settings - we'll store these in the DB later with a settings table
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.videoId, videoId));
    return video;
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const now = new Date();
    
    // Prepare the complete video object
    const videoData = {
      ...insertVideo,
      scrapedAt: now,
      lastAccessed: now,
      accessCount: 0
    };
    
    // Insert into database
    const [video] = await db.insert(videos).values(videoData).returning();
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveVideo(video).catch(error => {
        console.error('Failed to save video to Telegram channel:', error);
      });
    }
    
    return video;
  }

  async updateVideo(videoId: string, url: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.videoId, videoId));
    if (!video) return undefined;

    const [updatedVideo] = await db
      .update(videos)
      .set({ 
        url,
        scrapedAt: new Date()
      })
      .where(eq(videos.videoId, videoId))
      .returning();
      
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
    
    // Update access count and last accessed timestamp
    await db
      .update(videos)
      .set({ 
        accessCount: (video.accessCount || 0) + 1,
        lastAccessed: new Date()
      })
      .where(eq(videos.videoId, videoId));
  }

  async getRecentVideos(limit: number): Promise<Video[]> {
    return db
      .select()
      .from(videos)
      .orderBy(desc(videos.lastAccessed))
      .limit(limit);
  }

  // Domain methods
  async getAllDomains(): Promise<Domain[]> {
    return db.select().from(domains);
  }

  async getActiveDomains(): Promise<Domain[]> {
    return db.select().from(domains).where(eq(domains.active, true));
  }

  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    // Ensure domain names are normalized (lowercase, no trailing/leading whitespace)
    const normalizedDomain = insertDomain.domain.toLowerCase().trim();
    
    // Check if domain already exists to prevent duplicates
    const [existingDomain] = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, normalizedDomain));
      
    if (existingDomain) {
      // If domain exists but is inactive and we're trying to add it as active,
      // update it instead of creating a new one
      if (!existingDomain.active && insertDomain.active) {
        return this.toggleDomainStatus(existingDomain.id) as Promise<Domain>;
      }
      throw new Error(`Domain '${normalizedDomain}' already exists`);
    }
    
    // Insert the new domain
    const [domain] = await db
      .insert(domains)
      .values({
        ...insertDomain,
        domain: normalizedDomain,
        addedAt: new Date()
      })
      .returning();
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveDomain(domain).catch(error => {
        console.error('Failed to save domain to Telegram channel:', error);
      });
    }
    
    return domain;
  }

  async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id));
    if (!domain) return undefined;
    
    const [updatedDomain] = await db
      .update(domains)
      .set({ active: !domain.active })
      .where(eq(domains.id, id))
      .returning();
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveDomain(updatedDomain).catch(error => {
        console.error('Failed to save updated domain to Telegram channel:', error);
      });
    }
    
    return updatedDomain;
  }

  async deleteDomain(id: number): Promise<boolean> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id));
    if (!domain) return false;
    
    await db.delete(domains).where(eq(domains.id, id));
    
    // Log deletion if Telegram channel is enabled
    if (telegramBot.isChannelStorageEnabled() && storageInstance) {
      storageInstance.createLog({
        level: 'INFO',
        source: 'Domains',
        message: `Domain deleted: ${domain.domain}`
      });
    }
    
    return true;
  }

  async isDomainWhitelisted(domain: string): Promise<boolean> {
    // Special case: localhost and replit.dev domains are always whitelisted for development
    if (domain === 'localhost' || domain.endsWith('.replit.dev') || domain.endsWith('.repl.co')) {
      return true;
    }
    
    // Normalize the domain
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Check if the domain exists in the whitelist and is active
    const [whitelistedDomain] = await db
      .select()
      .from(domains)
      .where(and(
        eq(domains.domain, normalizedDomain),
        eq(domains.active, true)
      ));
    
    return !!whitelistedDomain;
  }

  // Log methods
  async getLogs(limit: number, offset: number, level?: string): Promise<{ logs: Log[], total: number }> {
    // First, get the total count
    const [{ count }] = await db
      .select({ 
        count: sql<number>`count(*)` 
      })
      .from(logs)
      .where(level ? eq(logs.level, level) : sql`1=1`);
    
    // Then get the actual logs with pagination
    const logsQuery = db
      .select()
      .from(logs)
      .orderBy(desc(logs.timestamp))
      .offset(offset)
      .limit(limit);
      
    // Add level filter if provided
    const results = await (level 
      ? logsQuery.where(eq(logs.level, level))
      : logsQuery);
    
    return {
      logs: results,
      total: count
    };
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const [log] = await db
      .insert(logs)
      .values({
        ...insertLog,
        timestamp: new Date()
      })
      .returning();
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveLog(log).catch(error => {
        console.error('Failed to save log to Telegram channel:', error);
      });
    }
    
    return log;
  }

  async clearLogs(): Promise<void> {
    await db.delete(logs);
  }

  // Settings
  async getScraperSettings(): Promise<typeof DEFAULT_SCRAPER_SETTINGS> {
    return this.scraperSettings;
  }

  async updateScraperSettings(settings: Partial<typeof DEFAULT_SCRAPER_SETTINGS>): Promise<typeof DEFAULT_SCRAPER_SETTINGS> {
    this.scraperSettings = {
      ...this.scraperSettings,
      ...settings
    };
    
    // Apply settings to the video scraper
    if (videoScraper) {
      await videoScraper.updateSettings(this.scraperSettings);
    }
    
    // If Telegram channel storage is enabled, save to channel
    if (telegramBot.isChannelStorageEnabled()) {
      telegramBot.saveSettings(this.scraperSettings).catch(error => {
        console.error('Failed to save settings to Telegram channel:', error);
      });
    }
    
    return this.scraperSettings;
  }
}

// Create and export the storage instance
export const dbStorage = new DatabaseStorage();

export const storageInstance = dbStorage;