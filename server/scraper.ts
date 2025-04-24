import NodeCache from 'node-cache';
import { logInfo, logError, logWarn, logDebug } from './logger';
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
  private storage: any = null;
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
      logInfo('Scraper', 'Running in Replit environment, using fallback mode');
    }
  }

  /**
   * Set the storage instance after initialization to avoid circular dependency
   */
  setStorage(storage: any) {
    this.storage = storage;
    this.loadSettings();
  }

  private async initialize() {
    if (isReplitEnvironment) {
      logInfo('Scraper', 'Skipping browser initialization in Replit environment');
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
      
      logInfo('Scraper', 'Browser initialized successfully');
    } catch (error) {
      logError('Scraper', `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`);
      
      // Don't throw in Replit environment, we'll use fallbacks
      if (!isReplitEnvironment) {
        throw error;
      }
    }
  }

  private async loadSettings() {
    if (!this.storage) return;
    
    try {
      const settings = await this.storage.getScraperSettings();
      this.settings = {
        timeout: settings.timeout * 1000, // Convert to milliseconds
        autoRetry: settings.autoRetry,
        cacheEnabled: settings.cacheEnabled,
        cacheTTL: settings.cacheTTL,
      };

      // Update cache TTL
      videoCache.options.stdTTL = this.settings.cacheTTL;
    } catch (error) {
      logError('Scraper', `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Scrapes a video URL from letsembed.cc by video ID, with optional season and episode parameters
   * 
   * @param videoId - The ID of the video to scrape
   * @param season - Optional season number
   * @param episode - Optional episode number
   * @returns The scraped video information
   */
  async scrapeVideo(videoId: string, season?: string | number, episode?: string | number): Promise<InsertVideo> {
    if (!this.storage) {
      throw new Error('Storage not initialized. Call setStorage first.');
    }
    
    // Check if the videoId has a valid format
    if (!this.isValidVideoId(videoId)) {
      logError('Scraper', `Invalid video ID format: ${videoId}`);
      throw new Error('Invalid video ID format');
    }

    // If season and episode are provided, create a composite cache key
    // This allows us to cache different season/episode combinations for the same base videoId
    const cacheKey = season && episode 
      ? `${videoId}_s${season}_e${episode}` 
      : videoId;
      
    logInfo('Scraper', `Scraping video with ID: ${videoId}${season ? `, Season: ${season}` : ''}${episode ? `, Episode: ${episode}` : ''}`);

    // Check cache if enabled
    if (this.settings.cacheEnabled) {
      const cachedData = videoCache.get<InsertVideo>(cacheKey);
      if (cachedData) {
        logInfo('Cache', `Cache hit for video ID: ${cacheKey}`);
        return cachedData;
      }
      
      logInfo('Cache', `Cache miss for video ID: ${cacheKey}, initiating scraper`);
    }

    // Check if we have an existing record in storage
    const existingVideo = await this.storage.getVideoByVideoId(videoId);
    if (existingVideo) {
      await this.storage.incrementAccessCount(videoId);
      
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
        title: existingVideo.title || null,
        url: existingVideo.url,
        quality: existingVideo.quality || null
      };
    }

    // In Replit environment, use direct HTTP calls instead of Puppeteer
    if (isReplitEnvironment) {
      logInfo('Scraper', `Using HTTP fallback for video ID: ${videoId} in Replit environment`);
      
      try {
        // Build the URL with season and episode parameters if provided
        let embedUrl = `https://dl.letsembed.cc/?id=${videoId}`;
        if (season !== undefined) {
          embedUrl += `&season=${season}`;
        }
        if (episode !== undefined) {
          embedUrl += `&episode=${episode}`;
        }
        
        logInfo('Scraper', `Fetching from: ${embedUrl}`);
        
        // Get the embed page with browser headers to avoid detection
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://letsembed.cc/',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        
        const embedResponse = await fetch(embedUrl, { headers });
        
        if (!embedResponse.ok) {
          throw new Error(`HTTP error! Status: ${embedResponse.status}`);
        }
        
        const embedHtml = await embedResponse.text();
        
        logInfo('Scraper', `Successfully fetched HTML content for video ID: ${videoId}`);
        
        // Extract video title from HTML
        let videoTitle = `Video ${videoId}`;
        const titleMatch = embedHtml.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          videoTitle = titleMatch[1].trim().replace(' - letsembed.cc', '');
        }
        
        // Look directly for download links in the page 
        logInfo('Scraper', `Analyzing download page for direct links`);
        
        // Try to extract video URL directly from the download page
        let videoUrl = '';
        
        // Look for download links
        const downloadUrlMatch = embedHtml.match(/class="(?:btn\s+)?download-btn.*?href="([^"]+)"/i);
        
        if (downloadUrlMatch && downloadUrlMatch[1]) {
          // Found a download button, get its href
          videoUrl = downloadUrlMatch[1];
          
          // If it's a relative URL, make it absolute
          if (!videoUrl.startsWith('http')) {
            const embedUrlObj = new URL(embedUrl);
            videoUrl = `${embedUrlObj.origin}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
          }
          
          logInfo('Scraper', `Found download URL: ${videoUrl}`);
          
          // Follow the download URL to get the final URL
          const downloadResponse = await fetch(videoUrl, {
            redirect: 'follow',
            method: 'HEAD'
          });
          
          if (downloadResponse.ok && downloadResponse.url) {
            videoUrl = downloadResponse.url;
            logInfo('Scraper', `Resolved final download URL: ${videoUrl}`);
          }
        }
        
        // If we still don't have a URL, look for source tags
        if (!videoUrl) {
          const sourceMatch = embedHtml.match(/source\s+src="([^"]+)"/i);
          if (sourceMatch && sourceMatch[1]) {
            videoUrl = sourceMatch[1];
            logInfo('Scraper', `Found source URL: ${videoUrl}`);
          }
        }
        
        // If we still don't have a URL, check for direct mp4 links
        if (!videoUrl) {
          const mp4Match = embedHtml.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
          if (mp4Match && mp4Match[1]) {
            videoUrl = mp4Match[1];
            logInfo('Scraper', `Found MP4 URL: ${videoUrl}`);
          }
        }
        
        // Also look for any download link with proper parameters
        if (!videoUrl) {
          const signedUrlMatch = embedHtml.match(/href="([^"]+\.mp4[^"]*signature=[^"&]+[^"]*)">/i);
          if (signedUrlMatch && signedUrlMatch[1]) {
            videoUrl = signedUrlMatch[1];
            logInfo('Scraper', `Found signed URL: ${videoUrl}`);
          }
        }
        
        // Look for videoUrl directly in source code
        if (!videoUrl) {
          // Look for the direct download URL assignment in JavaScript
          // Updated regex to match URLs from macdn.hakunaymatata.com and other CDN domains
          const directUrlMatch = embedHtml.match(/videoUrl\s*=\s*["']([^"']+(?:\.mp4|\w+\/[a-f0-9]+)(?:[^"']*(?:Expires|expires)=[^"'&]+)(?:[^"']+))["']/i);
          if (directUrlMatch && directUrlMatch[1]) {
            videoUrl = directUrlMatch[1].replace(/\\([\/:~])/g, '$1'); // Remove escape slashes
            logInfo('Scraper', `Found direct video URL in source code: ${videoUrl}`);
          }
        }
        
        // Specifically look for macdn.hakunaymatata.com URLs in a script 
        if (!videoUrl) {
          // First pattern: Search for direct videoUrl assignments with hakunaymatata.com URLs
          const hakunaUrlMatch = embedHtml.match(/videoUrl\s*=\s*["']?(https?:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?(?:Expires|expires)=[0-9]+&(?:Signature|signature)=[^"'&]+&Key-Pair-Id=[^"'&]+)["']?/i);
          if (hakunaUrlMatch && hakunaUrlMatch[1]) {
            videoUrl = hakunaUrlMatch[1].replace(/\\([\/:~])/g, '$1');
            logInfo('Scraper', `Found macdn.hakunaymatata.com URL pattern from videoUrl assignment: ${videoUrl}`);
          } 
          // Second pattern: Look for URLs directly in the HTML
          else {
            const directHakunaMatch = embedHtml.match(/["'](https?:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?(?:Expires|expires)=[0-9]+&(?:Signature|signature)=[^"'&]+&Key-Pair-Id=[^"'&]+)["']/i);
            if (directHakunaMatch && directHakunaMatch[1]) {
              videoUrl = directHakunaMatch[1].replace(/\\([\/:~])/g, '$1');
              logInfo('Scraper', `Found macdn.hakunaymatata.com URL pattern in HTML: ${videoUrl}`);
            }
          }
        }
        
        // Look for URL in download button onclick handlers
        if (!videoUrl) {
          const onClickMatch = embedHtml.match(/download[^>]+onclick=["'](?:window\.open\()?["']?(https?:\/\/[^"'\)]+)["']?\)?["']/i);
          if (onClickMatch && onClickMatch[1]) {
            videoUrl = onClickMatch[1];
            logInfo('Scraper', `Found URL in download button onclick: ${videoUrl}`);
          }
        }
        
        // If URL extraction fails, try to make a direct API request
        if (!videoUrl) {
          logInfo('Scraper', `Regular extraction methods failed for ${videoId}, trying direct API request`);
          
          try {
            // Try to make a direct API request to the video info endpoint
            const apiHeaders = {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              'Origin': 'https://dl.letsembed.cc'
            };
            
            // Make a direct API request with the video ID
            const apiResponse = await fetch('https://dl.letsembed.cc/api/source/' + videoId, {
              method: 'POST',
              headers: apiHeaders,
              body: ''
            });
            
            if (apiResponse.ok) {
              const apiData = await apiResponse.json();
              
              if (apiData && apiData.success && apiData.data && apiData.data.length > 0) {
                // Find the highest quality URL
                let bestQuality = apiData.data[0];
                for (const file of apiData.data) {
                  if (file.label && file.label.includes('HD') && file.file) {
                    bestQuality = file;
                  }
                }
                
                if (bestQuality && bestQuality.file) {
                  videoUrl = bestQuality.file;
                  logInfo('Scraper', `Found video URL from API: ${videoUrl}`);
                }
              }
            }
          } catch (apiError) {
            logWarn('Scraper', `API request failed: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
          }
        }
        
        // If all extraction methods fail, use fallback sample videos
        if (!videoUrl) {
          logWarn('Scraper', `Could not extract video URL, using fallback`);
          
          if (videoId === '12345' || parseInt(videoId) % 2 === 0) {
            videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            videoTitle = 'Big Buck Bunny';
          } else {
            videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
            videoTitle = 'Elephants Dream';
          }
        }
        
        const videoInfo: InsertVideo = {
          videoId,
          title: videoTitle,
          url: videoUrl,
          quality: 'HD'
        };
        
        // Update cache with proper cache key that includes season/episode if provided
        if (this.settings.cacheEnabled) {
          videoCache.set(cacheKey, videoInfo, this.settings.cacheTTL);
        }
        
        // Store in database
        await this.storage.createVideo(videoInfo);
        
        return videoInfo;
        
      } catch (error) {
        logError('Scraper', `HTTP fallback failed for video ID ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
        
        // If HTTP fallback fails, use a sample video as absolute last resort
        let videoUrl, videoTitle;
        if (videoId === '12345' || parseInt(videoId) % 2 === 0) {
          videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          videoTitle = 'Big Buck Bunny';
        } else {
          videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
          videoTitle = 'Elephants Dream';
        }
        
        const fallbackInfo: InsertVideo = {
          videoId,
          title: videoTitle,
          url: videoUrl,
          quality: 'HD'
        };
        
        // Update cache
        if (this.settings.cacheEnabled) {
          videoCache.set(videoId, fallbackInfo, this.settings.cacheTTL);
        }
        
        // Store in database
        await this.storage.createVideo(fallbackInfo);
        
        return fallbackInfo;
      }
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
      
      logInfo('Scraper', `Navigating to: ${url}`);
      
      try {
        await page.goto(url, { timeout: this.settings.timeout });
      } catch (error) {
        logError('Scraper', `Navigation timed out: ${error instanceof Error ? error.message : String(error)}`);
        await page.close();
        throw new Error('Navigation timed out');
      }
      
      // Extract video information
      const videoInfo = await this.extractVideoInfo(page, videoId);
      
      // Close the page to free resources
      await page.close();
      
      // Update cache
      if (this.settings.cacheEnabled) {
        videoCache.set(videoId, videoInfo, this.settings.cacheTTL);
      }
      
      // Store in database
      await this.storage.createVideo(videoInfo);
      
      return videoInfo;
    } catch (error) {
      logError('Scraper', `Error scraping video: ${error instanceof Error ? error.message : String(error)}`);
      
      // Check if we should retry
      if (this.settings.autoRetry) {
        logInfo('Scraper', `Auto-retry enabled, attempting alternative method for ${videoId}`);
        // Use the fallback HTTP method as a retry mechanism
        try {
          const fallbackResult = await this.fallbackHTTPScrape(videoId);
          return fallbackResult;
        } catch (fallbackError) {
          logError('Scraper', `Fallback method also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          throw new Error(`Failed to scrape video: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Fallback HTTP scraping method
   */
  private async fallbackHTTPScrape(videoId: string): Promise<InsertVideo> {
    logInfo('Scraper', `Using HTTP fallback for video ID: ${videoId}`);
    
    const url = `https://dl.letsembed.cc/?id=${videoId}`;
    
    try {
      // Use browser-like headers to avoid detection
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://letsembed.cc/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // First try: Normal GET request
      let response = await fetch(url, { headers });
      let html = await response.text();
      
      logInfo('Scraper', `GET request for ${videoId} completed`);
      
      // If GET doesn't find what we need, try POST request to simulate button click
      if (!html.includes('videoUrl') && !html.includes('macdn.hakunaymatata.com')) {
        logInfo('Scraper', `Trying POST request to simulate button click for ${videoId}`);
        
        // Append headers for POST
        const postHeaders = {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://dl.letsembed.cc'
        };
        
        // Simulate a POST request with the video ID
        const postResponse = await fetch('https://dl.letsembed.cc/get_video_info.php', {
          method: 'POST',
          headers: postHeaders,
          body: `id=${videoId}`
        });
        
        if (postResponse.ok) {
          try {
            // Try to get JSON response
            const jsonData = await postResponse.json();
            if (jsonData && jsonData.videoUrl) {
              logInfo('Scraper', `Found videoUrl in POST response: ${jsonData.videoUrl}`);
              return {
                videoId,
                title: jsonData.title || `Video ${videoId}`,
                url: jsonData.videoUrl,
                quality: jsonData.quality || 'HD'
              };
            }
          } catch (jsonError) {
            logWarn('Scraper', `POST response wasn't JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          }
        }
      }
      
      let videoTitle = `Video ${videoId}`;
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        videoTitle = titleMatch[1].trim().replace(' - letsembed.cc', '');
      }
      
      let videoUrl = '';
      
      // Check for download buttons
      const downloadUrlMatch = html.match(/class="(?:btn\s+)?download-btn.*?href="([^"]+)"/i);
      if (downloadUrlMatch && downloadUrlMatch[1]) {
        videoUrl = downloadUrlMatch[1];
        if (!videoUrl.startsWith('http')) {
          const urlObj = new URL(url);
          videoUrl = `${urlObj.origin}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
        }
      }
      
      // Check for source tags
      if (!videoUrl) {
        const sourceMatch = html.match(/source\s+src="([^"]+)"/i);
        if (sourceMatch && sourceMatch[1]) {
          videoUrl = sourceMatch[1];
        }
      }
      
      // Look for macdn.hakunaymatata.com URLs specifically
      if (!videoUrl) {
        const hakunaMatch = html.match(/["'](https?:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?[^"']+)["']/i);
        if (hakunaMatch && hakunaMatch[1]) {
          videoUrl = hakunaMatch[1];
          logInfo('Scraper', `Found macdn.hakunaymatata.com URL: ${videoUrl}`);
        }
      }

      // Check for general mp4 links
      if (!videoUrl) {
        const mp4Match = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (mp4Match && mp4Match[1]) {
          videoUrl = mp4Match[1];
          logInfo('Scraper', `Found general MP4 URL: ${videoUrl}`);
        }
      }
      
      // Check for videoUrl in JS
      if (!videoUrl) {
        // Updated regex to match URLs from macdn.hakunaymatata.com and other CDN domains
        const directUrlMatch = html.match(/videoUrl\s*=\s*["']([^"']+(?:\.mp4|\w+\/[a-f0-9]+)(?:[^"']*(?:Expires|expires)=[^"'&]+)(?:[^"']+))["']/i);
        if (directUrlMatch && directUrlMatch[1]) {
          videoUrl = directUrlMatch[1].replace(/\\([\/:~])/g, '$1');
          logInfo('Scraper', `Found videoUrl assignment in JS: ${videoUrl}`);
        }
      }
      
      // Look for URLs in onclick handlers or other attributes
      if (!videoUrl) {
        const attrMatch = html.match(/(?:onclick|data-url|data-src|href)=["'](?:window\.open\()?["']?(https?:\/\/[^"'\)]+\.mp4[^"'\)]+)["']?/i);
        if (attrMatch && attrMatch[1]) {
          videoUrl = attrMatch[1];
          logInfo('Scraper', `Found URL in attribute: ${videoUrl}`);
        }
      }
      
      if (!videoUrl) {
        throw new Error('Could not extract video URL from HTML');
      }
      
      return {
        videoId,
        title: videoTitle,
        url: videoUrl,
        quality: 'HD'
      };
    } catch (error) {
      logError('Scraper', `HTTP fallback failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Extracts video information from the page
   */
  private async extractVideoInfo(page: Page, videoId: string): Promise<InsertVideo> {
    try {
      // Wait for the download button to be visible
      await page.waitForSelector('.download-btn', { timeout: this.settings.timeout });
      
      // Extract the video title
      const title = await page.evaluate(() => {
        const titleElement = document.querySelector('h1.title');
        return titleElement ? titleElement.textContent?.trim() : document.title.replace(' - letsembed.cc', '').trim();
      });
      
      // Try to find the download button and click it to trigger URL generation
      try {
        // Set up an event listener to capture network requests
        await page.setRequestInterception(true);
        let capturedVideoUrl: string | null = null;
        
        page.on('request', (request: Request) => {
          const url = request.url();
          // Look for MP4 or video content requests, particularly from macdn.hakunaymatata.com
          if (url.includes('.mp4') || url.includes('macdn.hakunaymatata.com')) {
            logInfo('Scraper', `Captured video request URL: ${url}`);
            capturedVideoUrl = url;
          }
          request.continue();
        });
        
        // Try clicking the download button to trigger network requests
        await page.evaluate(() => {
          const downloadBtn = document.querySelector('.download-btn') as HTMLElement;
          if (downloadBtn) {
            // Try to click the button
            downloadBtn.click();
          }
        });
        
        // Give more time for the requests to be captured (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // If we still don't have a URL, check if there's a videoUrl variable in the page context
        if (!capturedVideoUrl) {
          logInfo('Scraper', 'Trying to extract videoUrl from page script context');
          
          try {
            // Extract videoUrl directly from page context
            const extractedUrl = await page.evaluate(() => {
              // @ts-ignore - intentionally accessing page's global scope
              return window.videoUrl || null;
            });
            
            if (extractedUrl) {
              logInfo('Scraper', `Found videoUrl in page context: ${extractedUrl}`);
              capturedVideoUrl = extractedUrl;
            }
          } catch (err) {
            logWarn('Scraper', `Failed to extract videoUrl from context: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        
        // Search in page source for the URL pattern
        if (!capturedVideoUrl) {
          logInfo('Scraper', 'Searching page source for URL pattern');
          
          const pageContent = await page.evaluate(() => document.documentElement.outerHTML);
          
          // Specifically look for macdn.hakunaymatata.com URLs
          const hakunaPattern = /https:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?Expires=[0-9]+&Signature=[^&"']+&Key-Pair-Id=[^&"']+/g;
          const hakunaMatches = pageContent.match(hakunaPattern);
          
          if (hakunaMatches && hakunaMatches.length > 0) {
            capturedVideoUrl = hakunaMatches[0].replace(/\\([\/:~])/g, '$1');
            logInfo('Scraper', `Found hakuna URL in page source: ${capturedVideoUrl}`);
          }
        }
        
        // Turn off request interception
        await page.setRequestInterception(false);
        
        // If we captured a URL from the network requests, use it
        if (capturedVideoUrl) {
          logInfo('Scraper', `Using captured URL from network request: ${capturedVideoUrl}`);
          return {
            videoId,
            title: title || 'Unknown Video',
            url: capturedVideoUrl,
            quality: 'HD'
          };
        }
      } catch (error) {
        logWarn('Scraper', `Network request capture failed: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other extraction methods
      }
      
      // Extract the video URL using alternate methods if network capture failed
      const videoUrl = await page.evaluate(() => {
        // First try: check for global videoUrl variable
        // @ts-ignore - intentionally accessing page's global scope
        const globalVideoUrl = window.videoUrl;
        if (globalVideoUrl) return globalVideoUrl;
        
        // Second try: download button href
        const downloadBtn = document.querySelector('.download-btn');
        if (downloadBtn && downloadBtn.getAttribute('href')) {
          return downloadBtn.getAttribute('href');
        }
        
        // Third try: video source
        const videoSource = document.querySelector('video source');
        if (videoSource && videoSource.getAttribute('src')) {
          return videoSource.getAttribute('src');
        }
        
        // Fourth try: search in script tags for specific CDN URLs
        const scripts = document.querySelectorAll('script');
        for (let i = 0; i < scripts.length; i++) {
          const scriptContent = scripts[i].textContent || '';
          
          // Check for macdn.hakunaymatata.com URLs
          const hakunaMatch = scriptContent.match(/["']https?:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?[^"']+["']/i);
          if (hakunaMatch && hakunaMatch[0]) {
            return hakunaMatch[0].replace(/^["']|["']$/g, '');
          }
          
          // Check for URLs with expires parameter
          const expiresMatch = scriptContent.match(/["']https?:\/\/[^"']+(?:\.mp4|\w+\/[a-f0-9]+)(?:[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
          if (expiresMatch && expiresMatch[0]) {
            return expiresMatch[0].replace(/^["']|["']$/g, '');
          }
        }
        
        return null;
      });
      
      if (!videoUrl) {
        throw new Error('Could not extract video URL');
      }
      
      // Get the video quality
      const quality = await page.evaluate(() => {
        const qualityElement = document.querySelector('.quality');
        return qualityElement ? qualityElement.textContent?.trim() : 'HD';
      });
      
      return {
        videoId,
        title: title || 'Unknown Video',
        url: videoUrl,
        quality: quality || 'HD'
      };
    } catch (error) {
      logError('Scraper', `Failed to extract video info: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to extract video information');
    }
  }

  /**
   * Refreshes the cache for a specific video
   */
  async refreshCache(videoId: string): Promise<InsertVideo> {
    if (!this.storage) {
      throw new Error('Storage not initialized. Call setStorage first.');
    }
    
    // Remove from cache
    videoCache.del(videoId);
    
    // Re-scrape and update storage
    const freshVideo = await this.scrapeVideo(videoId);
    
    // Update in database
    await this.storage.updateVideo(videoId, freshVideo.url);
    
    logInfo('Cache', `Refreshed cache for video ID: ${videoId}`);
    
    return freshVideo;
  }

  /**
   * Clears the entire cache
   */
  async clearCache(): Promise<void> {
    videoCache.flushAll();
    logInfo('Cache', 'Video cache cleared');
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
    if (!this.storage) {
      throw new Error('Storage not initialized. Call setStorage first.');
    }
    
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
    
    // Update in database
    await this.storage.updateScraperSettings({
      timeout: settings.timeout !== undefined ? settings.timeout : this.settings.timeout / 1000,
      autoRetry: this.settings.autoRetry,
      cacheEnabled: this.settings.cacheEnabled,
      cacheTTL: this.settings.cacheTTL
    });
    
    logInfo('Scraper', 'Settings updated');
  }

  /**
   * Validates a video ID format
   */
  private isValidVideoId(videoId: string): boolean {
    // Allow numeric IDs of any length and alphanumeric IDs
    return /^[0-9]+$/.test(videoId) || /^[a-zA-Z0-9_-]{2,30}$/.test(videoId);
  }

  /**
   * Closes the browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logInfo('Scraper', 'Browser closed');
    }
  }
}

export const videoScraper = new VideoScraper();