import NodeCache from 'node-cache';
import { storage } from './storage';
import { InsertVideo } from '@shared/schema';

// Cache for storing scraped URLs
const videoCache = new NodeCache();

// Track if we're running in Replit environment for fallback handling
const isReplitEnvironment = process.env.REPLIT_ENVIRONMENT === 'true' || process.env.NODE_ENV === 'development';

// Define interfaces for puppeteer objects
interface Request {
  continue(): void;
  abort(): void;
  respond(response: object): void;
  url(): string;
}

interface Response {
  url(): string;
  status(): number;
  text(): Promise<string>;
  json(): Promise<any>;
}

interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

interface Page {
  goto(url: string, options?: any): Promise<any>;
  waitForSelector(selector: string, options?: any): Promise<any>;
  setRequestInterception(value: boolean): Promise<void>;
  on(event: string, callback: (arg: any) => void): void;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}

// Create mock puppeteer for Replit environment
const mockPuppeteer = {
  launch: async () => {
    return {
      newPage: async () => {
        return {
          goto: async () => {},
          waitForSelector: async () => {},
          setRequestInterception: async () => {},
          on: () => {},
          evaluate: async () => "",
          close: async () => {}
        };
      },
      close: async () => {}
    };
  }
};

// Use real puppeteer only in non-Replit environments
const puppeteer = isReplitEnvironment ? mockPuppeteer : require('puppeteer');

/**
 * The VideoScraper class handles scraping video URLs from letsembed.cc
 */
export class VideoScraper {
  private browser: Browser | null = null;
  private settings = {
    timeout: 30000, // 30 seconds
    autoRetry: true,
    cacheEnabled: true,
    cacheTTL: 3600, // 1 hour
  };

  constructor() {
    if (!isReplitEnvironment) {
      this.initialize();
    } else {
      storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: 'Running in Replit environment, using fallback mode'
      });
    }
    this.loadSettings();
  }

  private async initialize() {
    if (isReplitEnvironment) {
      await storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: 'Skipping browser initialization in Replit environment'
      });
      return;
    }
    
    try {
      this.browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-features=site-per-process'
        ],
        headless: true, // Use the stable headless mode
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH // Use environment variable if available
      });
      
      await storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: 'Browser initialized successfully'
      });
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'Scraper',
        message: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
      });
      
      // Don't throw in Replit environment, we'll use fallbacks
      if (!isReplitEnvironment) {
        throw error;
      }
    }
  }

  private async loadSettings() {
    const settings = await storage.getScraperSettings();
    this.settings = {
      timeout: settings.timeout * 1000, // Convert to milliseconds
      autoRetry: settings.autoRetry,
      cacheEnabled: settings.cacheEnabled,
      cacheTTL: settings.cacheTTL,
    };

    // Update cache TTL
    videoCache.options.stdTTL = this.settings.cacheTTL;
  }

  /**
   * Scrapes a video URL from letsembed.cc by video ID
   * 
   * @param videoId - The ID of the video to scrape
   * @returns The scraped video information
   */
  async scrapeVideo(videoId: string): Promise<InsertVideo> {
    // Check if the videoId has a valid format
    if (!this.isValidVideoId(videoId)) {
      await storage.createLog({
        level: 'ERROR',
        source: 'Scraper',
        message: `Invalid video ID format: ${videoId}`
      });
      throw new Error('Invalid video ID format');
    }

    // Check cache if enabled
    if (this.settings.cacheEnabled) {
      const cachedData = videoCache.get<InsertVideo>(videoId);
      if (cachedData) {
        await storage.createLog({
          level: 'INFO',
          source: 'Cache',
          message: `Cache hit for video ID: ${videoId}`
        });
        return cachedData;
      }
      
      await storage.createLog({
        level: 'INFO',
        source: 'Cache',
        message: `Cache miss for video ID: ${videoId}, initiating scraper`
      });
    }

    // Check if we have an existing record in storage
    const existingVideo = await storage.getVideoByVideoId(videoId);
    if (existingVideo) {
      await storage.incrementAccessCount(videoId);
      
      // Update cache
      if (this.settings.cacheEnabled) {
        videoCache.set(videoId, {
          videoId: existingVideo.videoId,
          title: existingVideo.title,
          url: existingVideo.url,
          quality: existingVideo.quality
        }, this.settings.cacheTTL);
      }
      
      return {
        videoId: existingVideo.videoId,
        title: existingVideo.title,
        url: existingVideo.url,
        quality: existingVideo.quality
      };
    }

    // For demonstration purposes in Replit environment
    // Use fallback demo video in Replit environment to avoid browser dependency issues
    // This would be replaced with a proper scraping implementation in production
    if (isReplitEnvironment) {
      await storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: `Using development fallback for video ID: ${videoId} in Replit environment`
      });
      
      // Demo video data for development purposes
      let videoUrl = '';
      let videoTitle = '';
      
      // Use different sample videos based on the ID for variety
      if (videoId === '12345' || parseInt(videoId) % 2 === 0) {
        videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        videoTitle = 'Big Buck Bunny';
      } else {
        videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
        videoTitle = 'Elephants Dream';
      }
      
      const demoVideoInfo: InsertVideo = {
        videoId,
        title: videoTitle,
        url: videoUrl,
        quality: 'HD'
      };
      
      // Update cache
      if (this.settings.cacheEnabled) {
        videoCache.set(videoId, demoVideoInfo, this.settings.cacheTTL);
      }
      
      // Store in database
      await storage.createVideo(demoVideoInfo);
      
      return demoVideoInfo;
    }

    try {
      if (!this.browser) {
        await this.initialize();
      }

      // Ensure browser is available
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      // Create a new page
      const page = await this.browser.newPage();
      
      // Navigate to the letsembed page with the given ID
      const url = `https://dl.letsembed.cc/?id=${videoId}`;
      
      await storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: `Navigating to: ${url}`
      });
      
      await page.goto(url, { timeout: this.settings.timeout });

      // Wait for page to load
      await page.waitForSelector('.container', { timeout: this.settings.timeout });

      // Extract video information
      const videoInfo = await this.extractVideoInfo(page, videoId);
      
      // Close page
      await page.close();

      // Update cache
      if (this.settings.cacheEnabled) {
        videoCache.set(videoId, videoInfo, this.settings.cacheTTL);
      }

      // Store in database
      await storage.createVideo(videoInfo);
      
      await storage.createLog({
        level: 'INFO',
        source: 'Scraper',
        message: `Successfully extracted URL for ID ${videoId}`
      });

      return videoInfo;
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'Scraper',
        message: `Failed to scrape video ID ${videoId}: ${error instanceof Error ? error.message : String(error)}`
      });

      // Auto-retry if enabled
      if (this.settings.autoRetry) {
        await storage.createLog({
          level: 'INFO',
          source: 'Scraper',
          message: `Auto-retrying video ID ${videoId}`
        });
        
        // Reinitialize browser
        await this.closeBrowser();
        await this.initialize();
        
        return this.scrapeVideo(videoId);
      }

      throw error;
    }
  }

  /**
   * Extracts video information from the page
   */
  private async extractVideoInfo(page: Page, videoId: string): Promise<InsertVideo> {
    // Set up request interception to capture the video URL
    let videoUrl = '';
    let videoQuality = 'HD'; // Default quality
    let videoTitle = 'Video ' + videoId;
    
    // Setup network request interception
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    // Listen for responses to capture the video URL
    page.on('response', async response => {
      const url = response.url();
      
      // Look for MP4 video responses
      if (url.includes('.mp4') && url.includes('signature=') && url.includes('pair=')) {
        videoUrl = url;
        await storage.createLog({
          level: 'DEBUG',
          source: 'Scraper',
          message: `Captured video URL: ${videoUrl}`
        });
      }
    });
    
    // Try to extract video title from the page
    try {
      videoTitle = await page.evaluate(() => {
        const titleElement = document.querySelector('h1');
        return titleElement ? titleElement.textContent?.trim() || 'Video' : 'Video';
      });
    } catch (error) {
      // If title extraction fails, use default
      videoTitle = 'Video ' + videoId;
    }
    
    // Try to extract video quality from the page
    try {
      videoQuality = await page.evaluate(() => {
        const qualityElement = document.querySelector('[data-quality]');
        return qualityElement ? qualityElement.getAttribute('data-quality') || 'HD' : 'HD';
      });
    } catch (error) {
      // If quality extraction fails, use default
      videoQuality = 'HD';
    }
    
    // Click the download button to trigger the download request
    await page.evaluate(() => {
      const downloadBtn = document.querySelector('a.download-btn') as HTMLElement;
      if (downloadBtn) {
        downloadBtn.click();
      }
    });
    
    // Wait some time for the response to be captured
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // If we still don't have a URL, try to find it in available links
    if (!videoUrl) {
      videoUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href && href.includes('.mp4') && href.includes('signature=') && href.includes('pair=')) {
            return href;
          }
        }
        return '';
      });
    }
    
    // If we still don't have a URL, throw an error
    if (!videoUrl) {
      throw new Error('Failed to extract video URL');
    }
    
    return {
      videoId,
      title: videoTitle,
      url: videoUrl,
      quality: videoQuality
    };
  }

  /**
   * Refreshes the cache for a specific video
   */
  async refreshCache(videoId: string): Promise<InsertVideo> {
    // Remove from cache
    videoCache.del(videoId);
    
    // Update storage
    await storage.createLog({
      level: 'INFO',
      source: 'Cache',
      message: `Refreshing cache for video ID: ${videoId}`
    });
    
    // Re-scrape
    return this.scrapeVideo(videoId);
  }

  /**
   * Clears the entire cache
   */
  async clearCache(): Promise<void> {
    videoCache.flushAll();
    await storage.createLog({
      level: 'INFO',
      source: 'Cache',
      message: 'Cache cleared'
    });
  }

  /**
   * Updates scraper settings
   */
  async updateSettings(settings: {
    timeout?: number;
    autoRetry?: boolean;
    cacheEnabled?: boolean;
    cacheTTL?: number;
  }): Promise<void> {
    if (settings.timeout !== undefined) {
      this.settings.timeout = settings.timeout * 1000; // Convert to milliseconds
    }
    
    if (settings.autoRetry !== undefined) {
      this.settings.autoRetry = settings.autoRetry;
    }
    
    if (settings.cacheEnabled !== undefined) {
      this.settings.cacheEnabled = settings.cacheEnabled;
    }
    
    if (settings.cacheTTL !== undefined) {
      this.settings.cacheTTL = settings.cacheTTL;
      videoCache.options.stdTTL = settings.cacheTTL;
    }
    
    // Save settings to storage
    await storage.updateScraperSettings({
      timeout: this.settings.timeout / 1000, // Convert to seconds for storage
      autoRetry: this.settings.autoRetry,
      cacheEnabled: this.settings.cacheEnabled,
      cacheTTL: this.settings.cacheTTL
    });
    
    await storage.createLog({
      level: 'INFO',
      source: 'Scraper',
      message: 'Scraper settings updated'
    });
  }

  /**
   * Validates a video ID format
   */
  private isValidVideoId(videoId: string): boolean {
    // Simple validation - ensure it contains only digits
    return /^\d+$/.test(videoId);
  }

  /**
   * Closes the browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton instance
export const videoScraper = new VideoScraper();
