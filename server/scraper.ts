import NodeCache from 'node-cache';
import { logInfo, logError, logWarn, logDebug } from './logger';
import { InsertVideo, qualityOptionsToStringArray, subtitleOptionsToStringArray, QualityOption, SubtitleOption } from '@shared/schema';

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
 * The WovIeX class handles scraping video URLs from letsembed.cc
 */
export class WovIeX {
  private browser: Browser | null = null;
  private storage: any = null;
  private _lastQualityOptions: { label: string, url: string }[] = []; // Store quality options from last scrape
  private _lastSubtitleOptions: { label: string, url: string, language?: string }[] = []; // Store subtitle options from last scrape
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

    // Only check cache if enabled AND we're not using season/episode parameters
    // This ensures we always fetch a fresh URL when season/episode parameters are provided
    if (this.settings.cacheEnabled && !season && !episode) {
      const cachedData = videoCache.get<InsertVideo>(cacheKey);
      if (cachedData) {
        logInfo('Cache', `Cache hit for video ID: ${cacheKey}`);
        return cachedData;
      }
      
      logInfo('Cache', `Cache miss for video ID: ${cacheKey}, initiating scraper`);
    } else if (season || episode) {
      logInfo('Cache', `Bypassing cache for season/episode request: ${cacheKey}`);
    }

    // Only use existing storage record if we're NOT requesting a specific season/episode
    // Otherwise, always fetch a fresh URL for season/episode combinations
    const existingVideo = await this.storage.getVideoByVideoId(videoId);
    if (existingVideo && !season && !episode) {
      await this.storage.incrementAccessCount(videoId);
      
      // Update cache only for the base videoId (no season/episode)
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
    } else if (existingVideo) {
      // Only increment access count if we found an existing record
      await this.storage.incrementAccessCount(videoId);
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
          videoTitle = titleMatch[1].trim()
            .replace(' - letsembed.cc', '')
            .replace(' | Downloader', '')
            .replace(' | Video Downloader', '');
        }
        
        // Look directly for download links in the page 
        logInfo('Scraper', `Analyzing download page for direct links`);
        
        // UPDATED EXTRACTION LOGIC TO FIX WRONG LINKS
        
        // Try to extract video URL directly using the modern API approach first
        // This is the most reliable method as of April 2025
        let videoUrl = '';
        
        // First attempt: Use the direct API endpoint to get the video URL
        try {
          logInfo('Scraper', `Trying direct API extraction for ${videoId}`);
          
          const apiEndpoint = `https://dl.letsembed.cc/api/source/${videoId}`;
          const apiResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://dl.letsembed.cc/?id=${videoId}`,
              'Origin': 'https://dl.letsembed.cc'
            }
          });
          
          if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            
            if (apiData && apiData.success && apiData.data && apiData.data.length > 0) {
              // Sort files by quality and find the highest quality
              const files = apiData.data.sort((a: any, b: any) => {
                const aQuality = a.label ? parseInt(a.label.replace(/[^\d]/g, '')) || 0 : 0;
                const bQuality = b.label ? parseInt(b.label.replace(/[^\d]/g, '')) || 0 : 0;
                return bQuality - aQuality;
              });
              
              // Store all quality options for later use
              this._lastQualityOptions = files.map((file: any) => ({
                label: file.label || 'HD',
                url: file.file
              }));
              
              logInfo('Scraper', `Extracted ${this._lastQualityOptions.length} quality options from API`);
              
              // Look for subtitle data in the API response
              if (apiData.subtitles && Array.isArray(apiData.subtitles) && apiData.subtitles.length > 0) {
                // Convert subtitle info to our format
                const subtitleOptions: SubtitleOption[] = apiData.subtitles.map((sub: any) => ({
                  label: sub.label || 'English',
                  url: sub.file,
                  language: sub.label.toLowerCase().includes('english') ? 'en' : 
                             sub.label.substring(0, 2).toLowerCase()
                }));
                
                // Store for insertion
                if (subtitleOptions.length > 0) {
                  logInfo('Scraper', `Extracted ${subtitleOptions.length} subtitle options from API`);
                  // Store subtitle options directly
                  this._lastSubtitleOptions = subtitleOptions;
                }
              } else {
                // Reset subtitle options if none found
                this._lastSubtitleOptions = [];
              }
              
              if (files[0] && files[0].file) {
                videoUrl = files[0].file;
                logInfo('Scraper', `Found video URL from API (highest quality): ${videoUrl}`);
              }
            }
          } else {
            logWarn('Scraper', `API request failed with status: ${apiResponse.status}`);
          }
        } catch (apiError) {
          logWarn('Scraper', `API extraction error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
        
        // Second attempt: If API fails, extract from HTML and JavaScript
        if (!videoUrl) {
          logInfo('Scraper', 'API extraction failed, trying HTML extraction');
          
          // Try to find URLs in the script sources first (most reliable)
          const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
          let scriptMatch;
          let scripts = [];
          
          while ((scriptMatch = scriptRegex.exec(embedHtml)) !== null) {
            scripts.push(scriptMatch[1]);
          }
          
          // Find videoUrl assignment in scripts
          for (const script of scripts) {
            // Look for modern direct URL assignment format
            const modernUrlMatch = script.match(/videoUrl\s*=\s*["']([^"']+\.mp4[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
            if (modernUrlMatch && modernUrlMatch[1]) {
              videoUrl = modernUrlMatch[1].replace(/\\([\/:~])/g, '$1');
              logInfo('Scraper', `Found modern video URL format: ${videoUrl}`);
              break;
            }
            
            // Look for CloudFront URLs (which are now more common)
            const cloudFrontMatch = script.match(/["'](https?:\/\/[^"']+cloudfront\.net\/[^"']+\.mp4[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
            if (cloudFrontMatch && cloudFrontMatch[1]) {
              videoUrl = cloudFrontMatch[1].replace(/\\([\/:~])/g, '$1');
              logInfo('Scraper', `Found CloudFront URL: ${videoUrl}`);
              break;
            }

            // Look for Hakuna Matata URLs (hakunaymatata.com)
            const hakunaMatch = script.match(/["'](https?:\/\/[^"']+hakunaymatata\.com\/resource\/[^"']+\.mp4[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
            if (hakunaMatch && hakunaMatch[1]) {
              videoUrl = hakunaMatch[1].replace(/\\([\/:~])/g, '$1');
              logInfo('Scraper', `Found hakunaymatata URL: ${videoUrl}`);
              break;
            }
            
            // Check for object structure with file property
            const objectMatch = script.match(/file:\s*["']([^"']+\.mp4[^"']*)["']/i);
            if (objectMatch && objectMatch[1]) {
              videoUrl = objectMatch[1].replace(/\\([\/:~])/g, '$1');
              logInfo('Scraper', `Found file property URL: ${videoUrl}`);
              break;
            }
          }
          
          // If still no URL, try traditional source tag extraction
          if (!videoUrl) {
            const sourceMatch = embedHtml.match(/<source[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (sourceMatch && sourceMatch[1]) {
              videoUrl = sourceMatch[1];
              logInfo('Scraper', `Found source tag URL: ${videoUrl}`);
            }
          }
          
          // Last resort: look for any .mp4 URLs in the page
          if (!videoUrl) {
            const mp4Match = embedHtml.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
            if (mp4Match && mp4Match[1]) {
              videoUrl = mp4Match[1];
              logInfo('Scraper', `Found generic mp4 URL: ${videoUrl}`);
            }
          }

          // Check for quality options in select element - first try with videoSelect id (older format)
          let foundQualityOptions = false;
          const selectMatch = embedHtml.match(/<select[^>]*id=["']videoSelect["'][^>]*>([\s\S]*?)<\/select>/i);
          if (selectMatch && selectMatch[1]) {
            const selectContent = selectMatch[1];
            const optionRegex = /<option[^>]*value=["']([^"']+)["'][^>]*>\s*([^<]*?)\s*<\/option>/gi;
            let optionMatch;
            const qualityOptions = [];
            
            while ((optionMatch = optionRegex.exec(selectContent)) !== null) {
              // Decode HTML entities in the URL (e.g., &amp; -> &)
              const url = optionMatch[1].replace(/&amp;/g, '&')
                                       .replace(/&lt;/g, '<')
                                       .replace(/&gt;/g, '>')
                                       .replace(/&quot;/g, '"')
                                       .replace(/&#039;/g, "'");
              const label = optionMatch[2].trim();
              
              if (url && label) {
                qualityOptions.push({
                  label,
                  url
                });
                logInfo('Scraper', `Found quality option: ${label} -> ${url.substring(0, 50)}...`);
              }
            }
            
            if (qualityOptions.length > 0) {
              // Sort by quality (try to get highest)
              qualityOptions.sort((a, b) => {
                const aNum = parseInt(a.label.replace(/[^\d]/g, '')) || 0;
                const bNum = parseInt(b.label.replace(/[^\d]/g, '')) || 0;
                return bNum - aNum;
              });
              
              // Store quality options for later use
              this._lastQualityOptions = qualityOptions;
              
              // If we don't have a video URL yet, use the highest quality
              if (!videoUrl && qualityOptions[0]) {
                videoUrl = qualityOptions[0].url;
                logInfo('Scraper', `Using highest quality option (${qualityOptions[0].label}) as main video URL`);
              }
              
              foundQualityOptions = true;
            }
          } 
          
          // New format (2025): Look for select with name "quality" (Ra.One type interface)
          if (!foundQualityOptions) {
            const qualitySelectMatch = embedHtml.match(/<select[^>]*name=["']quality["'][^>]*>([\s\S]*?)<\/select>/i);
            if (qualitySelectMatch && qualitySelectMatch[1]) {
              const selectContent = qualitySelectMatch[1];
              const optionRegex = /<option[^>]*value=["']([^"']+)["'][^>]*>\s*([^<]*?)\s*<\/option>/gi;
              let optionMatch;
              const qualityOptions = [];
              
              while ((optionMatch = optionRegex.exec(selectContent)) !== null) {
                // Decode HTML entities in the URL (e.g., &amp; -> &)
                const url = optionMatch[1].replace(/&amp;/g, '&')
                                         .replace(/&lt;/g, '<')
                                         .replace(/&gt;/g, '>')
                                         .replace(/&quot;/g, '"')
                                         .replace(/&#039;/g, "'");
                const label = optionMatch[2].trim();
                
                if (url && label) {
                  qualityOptions.push({
                    label,
                    url
                  });
                  logInfo('Scraper', `Found quality option (new format): ${label} -> ${url.substring(0, 50)}...`);
                }
              }
              
              if (qualityOptions.length > 0) {
                // Sort by quality (try to get highest)
                qualityOptions.sort((a, b) => {
                  const aNum = parseInt(a.label.replace(/[^\d]/g, '')) || 0;
                  const bNum = parseInt(b.label.replace(/[^\d]/g, '')) || 0;
                  return bNum - aNum;
                });
                
                // Store quality options for later use
                this._lastQualityOptions = qualityOptions;
                
                // If we don't have a video URL yet, use the highest quality
                if (!videoUrl && qualityOptions[0]) {
                  videoUrl = qualityOptions[0].url;
                  logInfo('Scraper', `Using highest quality option (new format) (${qualityOptions[0].label}) as main video URL`);
                }
              }
            }
          }
          
          // Look for subtitle options in a select element (both name="subtitle" and id="subtitleSelect")
          const subtitleSelectMatch = embedHtml.match(/<select[^>]*(?:name=["']subtitle["']|id=["']subtitleSelect["'])[^>]*>([\s\S]*?)<\/select>/i);
          if (subtitleSelectMatch && subtitleSelectMatch[1]) {
            const selectContent = subtitleSelectMatch[1];
            const optionRegex = /<option[^>]*value=["']([^"']+)["'][^>]*>\s*([^<]*?)\s*<\/option>/gi;
            let optionMatch;
            const subtitleOptions = [];
            
            while ((optionMatch = optionRegex.exec(selectContent)) !== null) {
              // Decode HTML entities in the URL (e.g., &amp; -> &)
              const url = optionMatch[1].replace(/&amp;/g, '&')
                                       .replace(/&lt;/g, '<')
                                       .replace(/&gt;/g, '>')
                                       .replace(/&quot;/g, '"')
                                       .replace(/&#039;/g, "'");
              const label = optionMatch[2].trim();
              
              if (url && label && url !== "no" && url !== "") {
                let language = 'en'; // Default language code
                
                // Try to determine language code from the label
                if (label.toLowerCase().includes('english')) {
                  language = 'en';
                } else if (label.toLowerCase().includes('arabic') || label.includes('اَلْعَرَبِيَّةُ')) {
                  language = 'ar';
                } else if (label.toLowerCase().includes('bengali') || label.includes('বাংলা')) {
                  language = 'bn';
                } else if (label.toLowerCase().includes('chinese') || label.includes('中文')) {
                  language = 'zh';
                } else if (label.toLowerCase().includes('french') || label.toLowerCase().includes('français')) {
                  language = 'fr';
                } else if (label.toLowerCase().includes('indonesian')) {
                  language = 'id';
                } else if (label.toLowerCase().includes('punjabi') || label.includes('ਪੰਜਾਬੀ')) {
                  language = 'pa';
                } else if (label.toLowerCase().includes('portuguese') || label.includes('português')) {
                  language = 'pt';
                } else if (label.toLowerCase().includes('russian') || label.includes('русский')) {
                  language = 'ru';
                } else if (label.toLowerCase().includes('urdu') || label.includes('اُردُو')) {
                  language = 'ur';
                } else if (label.toLowerCase().includes('filipino')) {
                  language = 'fil';
                }
                
                subtitleOptions.push({
                  label,
                  url,
                  language
                });
                logInfo('Scraper', `Found subtitle option: ${label} (${language}) -> ${url.substring(0, 50)}...`);
              }
            }
            
            if (subtitleOptions.length > 0) {
              // Store subtitle options for later use
              this._lastSubtitleOptions = subtitleOptions;
            }
          }
        }
        if (!videoUrl) {
          // Check for download button onclick handler
          const onClickMatch = embedHtml.match(/download[^>]+onclick=["'](?:window\.open\()?["']?(https?:\/\/[^"'\)]+)["']?\)?["']/i);
          if (onClickMatch && onClickMatch[1]) {
            videoUrl = onClickMatch[1];
            logInfo('Scraper', `Found URL in download button onclick: ${videoUrl}`);
          }
          
          // Check for downloadFrame setup (Ra.One interface)
          if (!videoUrl) {
            const downloadFrameMatch = embedHtml.match(/frame\.src\s*=\s*videoUrl/i);
            if (downloadFrameMatch) {
              logInfo('Scraper', `Found downloadFrame setup, extracting from videoSelect`);
              
              // Get first value from videoSelect if we haven't parsed quality options yet
              if (this._lastQualityOptions.length === 0) {
                const videoSelectValueMatch = embedHtml.match(/<option[^>]*value=["']([^"']+)["'][^>]*>/i);
                if (videoSelectValueMatch && videoSelectValueMatch[1]) {
                  // Decode HTML entities in the URL (e.g., &amp; -> &)
                  videoUrl = videoSelectValueMatch[1].replace(/&amp;/g, '&')
                                                   .replace(/&lt;/g, '<')
                                                   .replace(/&gt;/g, '>')
                                                   .replace(/&quot;/g, '"')
                                                   .replace(/&#039;/g, "'");
                  logInfo('Scraper', `Found videoSelect first value as URL: ${videoUrl.substring(0, 50)}...`);
                }
              } else {
                // Use highest quality from already parsed options
                videoUrl = this._lastQualityOptions[0].url;
                logInfo('Scraper', `Using highest quality from parsed options: ${videoUrl.substring(0, 50)}...`);
              }
            }
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
                // Find the highest quality URL and collect all quality options
                let bestQuality = apiData.data[0];
                const allQualityOptions = [];
                
                for (const file of apiData.data) {
                  if (file.label && file.file) {
                    // Add to quality options
                    allQualityOptions.push({
                      label: file.label,
                      url: file.file
                    });
                    
                    // Update best quality if this is HD
                    if (file.label.includes('HD') || file.label.includes('720p') || file.label.includes('1080p')) {
                      bestQuality = file;
                    }
                  }
                }
                
                if (bestQuality && bestQuality.file) {
                  videoUrl = bestQuality.file;
                  logInfo('Scraper', `Found video URL from API: ${videoUrl}`);
                  logInfo('Scraper', `Found ${allQualityOptions.length} quality options`);
                }
                
                // Store the quality options for later use
                this._lastQualityOptions = allQualityOptions;
              }
            }
          } catch (apiError) {
            logWarn('Scraper', `API request failed: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
          }
        }
        
        // If all extraction methods fail, return an empty URL to show error on player
        if (!videoUrl) {
          logWarn('Scraper', `Could not extract video URL for ${videoId}`);
          
          // Return empty URL
          videoUrl = '';
        }
        
        const videoInfo: InsertVideo = {
          videoId,
          title: videoTitle,
          url: videoUrl,
          quality: 'HD',
          qualityOptions: this._lastQualityOptions.length > 0 ? 
            qualityOptionsToStringArray(this._lastQualityOptions) :
            undefined,
          subtitleOptions: this._lastSubtitleOptions.length > 0 ?
            subtitleOptionsToStringArray(this._lastSubtitleOptions.map(item => ({
              label: item.label,
              url: item.url,
              language: item.language || 'en'
            }))) :
            undefined
        };
        
        // Store in database - always store the base video with the current URL
        // This helps with organization and tracking the most recent URL
        await this.storage.createVideo(videoInfo);
        
        // For season/episode specific requests, only cache with the specific key
        // Do not update the base videoId cache to prevent conflicts
        if (this.settings.cacheEnabled) {
          if (season || episode) {
            // Store in cache with the composite key (with season/episode)
            videoCache.set(cacheKey, videoInfo, this.settings.cacheTTL);
            logInfo('Cache', `Cached season/episode specific URL with key: ${cacheKey}`);
          } else {
            // Store in cache with the base videoId key (no season/episode)
            videoCache.set(videoId, videoInfo, this.settings.cacheTTL);
            logInfo('Cache', `Cached base URL with key: ${videoId}`);
          }
        }
        
        return videoInfo;
        
      } catch (error) {
        logError('Scraper', `HTTP fallback failed for video ID ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
        
        // If HTTP fallback fails, return empty URL for error handling
        // Don't use sample videos - client prefers a clean error state
        const videoUrl = '';
        const videoTitle = `Video ${videoId}`;
        
        const fallbackInfo: InsertVideo = {
          videoId,
          title: videoTitle,
          url: videoUrl,
          quality: 'HD'
        };
        
        // Store in database
        await this.storage.createVideo(fallbackInfo);
        
        // Update cache with the appropriate cache key
        if (this.settings.cacheEnabled) {
          if (season || episode) {
            // Cache with season/episode specific key
            videoCache.set(cacheKey, fallbackInfo, this.settings.cacheTTL);
            logInfo('Cache', `Cached fallback content with season/episode key: ${cacheKey}`);
          } else {
            // Cache with base videoId
            videoCache.set(videoId, fallbackInfo, this.settings.cacheTTL);
            logInfo('Cache', `Cached fallback content with base key: ${videoId}`);
          }
        }
        
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
      
      // Store in database
      await this.storage.createVideo(videoInfo);
      
      // Update cache with the appropriate cache key
      if (this.settings.cacheEnabled) {
        if (season || episode) {
          // Store in cache with the composite key (with season/episode)
          videoCache.set(cacheKey, videoInfo, this.settings.cacheTTL);
          logInfo('Cache', `Cached puppeteer-extracted URL with season/episode key: ${cacheKey}`);
        } else {
          // Store in cache with the base videoId key (no season/episode)
          videoCache.set(videoId, videoInfo, this.settings.cacheTTL);
          logInfo('Cache', `Cached puppeteer-extracted URL with base key: ${videoId}`);
        }
      }
      
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
    logInfo('Scraper', `Using IMPROVED HTTP fallback for video ID: ${videoId}`);
    
    try {
      // Modern browser-like headers to avoid detection
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://letsembed.cc/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Microsoft Edge";v="121", "Not A(Brand";v="99", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
      };
      
      // ATTEMPT #1: DIRECT API REQUEST (most reliable)
      logInfo('Scraper', 'Fallback: Attempting direct API request first');
      
      try {
        const apiHeaders = {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://dl.letsembed.cc'
        };
        
        // This direct API request is the most reliable way to get the video URL
        const apiEndpoint = `https://dl.letsembed.cc/api/source/${videoId}`;
        const apiResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: apiHeaders,
          body: ''
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          
          if (apiData && apiData.success && apiData.data && apiData.data.length > 0) {
            // Sort by quality (highest first)
            const files = apiData.data.sort((a: any, b: any) => {
              const aQuality = a.label ? parseInt(a.label.replace(/[^\d]/g, '')) || 0 : 0;
              const bQuality = b.label ? parseInt(b.label.replace(/[^\d]/g, '')) || 0 : 0;
              return bQuality - aQuality;
            });
            
            if (files[0] && files[0].file) {
              const videoUrl = files[0].file;
              logInfo('Scraper', `Fallback: Found video URL via API: ${videoUrl}`);
              
              // If we have a valid URL from API, use it and skip other attempts
              return {
                videoId,
                title: `Video ${videoId}`,
                url: videoUrl,
                quality: files[0].label || 'HD'
              };
            }
          } else {
            logWarn('Scraper', `Fallback: API returned success: ${apiData?.success}, with ${apiData?.data?.length || 0} files`);
          }
        } else {
          logWarn('Scraper', `Fallback: API request failed with status ${apiResponse.status}`);
        }
      } catch (apiError) {
        logWarn('Scraper', `Fallback: API request exception: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      }
      
      // ATTEMPT #2: Try POST to get_video_info.php
      try {
        logInfo('Scraper', `Trying alternative POST endpoint for ${videoId}`);
        
        const postHeaders = {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://dl.letsembed.cc'
        };
        
        // New - Try a direct POST to the info endpoint
        const infoResponse = await fetch('https://dl.letsembed.cc/get_video_info.php', {
          method: 'POST',
          headers: postHeaders,
          body: `id=${videoId}`
        });
        
        if (infoResponse.ok) {
          try {
            // Try to get JSON response
            const jsonData = await infoResponse.json();
            if (jsonData && jsonData.videoUrl) {
              logInfo('Scraper', `Found videoUrl in alternative POST response: ${jsonData.videoUrl}`);
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
      } catch (postError) {
        logWarn('Scraper', `Alternative POST request failed: ${postError instanceof Error ? postError.message : String(postError)}`);
      }
      
      // ATTEMPT #3: GET THE HTML PAGE AND PARSE IT
      logInfo('Scraper', 'Fallback: Previous attempts failed, trying HTML page extraction');
      
      const url = `https://dl.letsembed.cc/?id=${videoId}`;
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Extract the title
      let videoTitle = `Video ${videoId}`;
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        videoTitle = titleMatch[1]
          .replace(' - letsembed.cc', '')
          .replace(' | Downloader', '')
          .replace(' | Video Downloader', '')
          .trim();
      }
      
      // Extract all script contents
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;
      const scripts = [];
      
      while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        scripts.push(scriptMatch[1]);
      }
      
      let videoUrl = '';
      
      // Find URL patterns in scripts first (most reliable)
      for (const script of scripts) {
        // Look for direct videoUrl assignments
        const directUrlMatch = script.match(/videoUrl\s*=\s*["']([^"']+\.mp4[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
        if (directUrlMatch && directUrlMatch[1]) {
          videoUrl = directUrlMatch[1].replace(/\\([\/:~])/g, '$1');
          logInfo('Scraper', `Fallback: Found direct videoUrl: ${videoUrl}`);
          break;
        }
        
        // Look for CloudFront URLs
        const cloudFrontMatch = script.match(/["'](https?:\/\/[^"']+cloudfront\.net\/[^"']+\.mp4[^"']*(?:Expires|expires)=[^"'&]+[^"']*)["']/i);
        if (cloudFrontMatch && cloudFrontMatch[1]) {
          videoUrl = cloudFrontMatch[1].replace(/\\([\/:~])/g, '$1');
          logInfo('Scraper', `Fallback: Found CloudFront URL: ${videoUrl}`);
          break;
        }
        
        // Look for file properties
        const fileMatch = script.match(/file:\s*["']([^"']+\.mp4[^"']*)["']/i);
        if (fileMatch && fileMatch[1]) {
          videoUrl = fileMatch[1].replace(/\\([\/:~])/g, '$1');
          logInfo('Scraper', `Fallback: Found file property URL: ${videoUrl}`);
          break;
        }
        
        // Look for macdn.hakunaymatata.com URLs specifically (common CDN)
        const hakunaMatch = script.match(/["'](https?:\/\/macdn\.hakunaymatata\.com\/resource\/[a-f0-9]+\.mp4\?[^"']+)["']/i);
        if (hakunaMatch && hakunaMatch[1]) {
          videoUrl = hakunaMatch[1].replace(/\\([\/:~])/g, '$1');
          logInfo('Scraper', `Fallback: Found hakunaymatata URL: ${videoUrl}`);
          break;
        }
      }
      
      // If no URL found in scripts, try other patterns in the HTML
      if (!videoUrl) {
        // Try download links first
        const downloadMatch = html.match(/class="(?:btn\s+)?download-btn.*?href="([^"]+)"/i);
        if (downloadMatch && downloadMatch[1]) {
          videoUrl = downloadMatch[1];
          
          // Make relative URLs absolute
          if (!videoUrl.startsWith('http')) {
            videoUrl = new URL(videoUrl, 'https://dl.letsembed.cc').toString();
          }
          
          logInfo('Scraper', `Fallback: Found download button URL: ${videoUrl}`);
          
          // Follow the download link to get the final URL
          try {
            const downloadResponse = await fetch(videoUrl, {
              method: 'HEAD',
              redirect: 'follow',
              headers
            });
            
            if (downloadResponse.ok && downloadResponse.url) {
              videoUrl = downloadResponse.url;
              logInfo('Scraper', `Fallback: Resolved final download URL: ${videoUrl}`);
            }
          } catch (error) {
            logWarn('Scraper', `Fallback: Error following download link: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      // Look for URLs in onclick handlers or other attributes
      if (!videoUrl) {
        const attrMatch = html.match(/(?:onclick|data-url|data-src|href)=["'](?:window\.open\()?["']?(https?:\/\/[^"'\)]+\.mp4[^"'\)]+)["']?/i);
        if (attrMatch && attrMatch[1]) {
          videoUrl = attrMatch[1];
          logInfo('Scraper', `Fallback: Found URL in attribute: ${videoUrl}`);
        }
      }
      
      // Look for source tags
      if (!videoUrl) {
        const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (sourceMatch && sourceMatch[1]) {
          videoUrl = sourceMatch[1];
          logInfo('Scraper', `Fallback: Found source tag URL: ${videoUrl}`);
        }
      }
      
      // Last resort: find any .mp4 URL in the HTML
      if (!videoUrl) {
        const mp4Match = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (mp4Match && mp4Match[1]) {
          videoUrl = mp4Match[1];
          logInfo('Scraper', `Fallback: Found generic mp4 URL: ${videoUrl}`);
        }
      }
      
      // If still no URL, try a last attempt API call with a different endpoint
      if (!videoUrl) {
        try {
          logInfo('Scraper', 'Final attempt: Trying alternative API endpoint');
          
          const finalApiResponse = await fetch(`https://dl.letsembed.cc/api/get_direct_link.php?id=${videoId}`, {
            headers: {
              ...headers,
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (finalApiResponse.ok) {
            try {
              const apiData = await finalApiResponse.json();
              if (apiData && apiData.url) {
                videoUrl = apiData.url;
                logInfo('Scraper', `Found URL from final API attempt: ${videoUrl}`);
              }
            } catch (e) {
              logWarn('Scraper', 'Final API attempt returned non-JSON response');
            }
          }
        } catch (finalApiError) {
          logWarn('Scraper', `Final API attempt failed: ${finalApiError instanceof Error ? finalApiError.message : String(finalApiError)}`);
        }
      }
      
      // If still no URL, throw an error to use the fallback video
      if (!videoUrl) {
        throw new Error('Could not extract video URL from any source');
      }
      
      return {
        videoId,
        title: videoTitle,
        url: videoUrl,
        quality: 'HD'
      };
      
    } catch (error) {
      // Log the error but don't fail - use a default video instead
      logError('Scraper', `HTTP fallback failed for ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Use a sample video as last resort
      const fallbackUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
      logWarn('Scraper', `Using sample video as ultimate fallback: ${fallbackUrl}`);
      
      return {
        videoId,
        title: `Video ${videoId}`,
        url: fallbackUrl,
        quality: 'HD'
      };
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
      
      // Look for quality options and subtitle options in the download page
      const qualityOptions = await page.evaluate(() => {
        const options: Array<{label: string, url: string}> = [];
        const qualitySelect = document.querySelector('#videoSelect');
        if (qualitySelect) {
          const optionElements = qualitySelect.querySelectorAll('option');
          optionElements.forEach(opt => {
            if (opt.value && opt.textContent) {
              options.push({
                label: opt.textContent.trim(),
                url: opt.value
              });
            }
          });
        }
        return options;
      });
      
      // Extract subtitle options if available
      const subtitleOptions = await page.evaluate(() => {
        const options: Array<{label: string, url: string, language: string}> = [];
        const subtitleSelect = document.querySelector('#subtitleSelect');
        if (subtitleSelect) {
          const optionElements = subtitleSelect.querySelectorAll('option');
          // Skip first option if it's "No Subtitle"
          let skipFirst = optionElements.length > 0 && 
                          optionElements[0].textContent && 
                          optionElements[0].textContent.includes('No Subtitle');
          
          optionElements.forEach((opt, index) => {
            if (skipFirst && index === 0) return;
            
            if (opt.value && opt.textContent) {
              options.push({
                label: opt.textContent.trim(),
                url: opt.value,
                language: opt.textContent.trim().toLowerCase().includes('english') ? 'en' : 
                          opt.textContent.trim().substring(0, 2).toLowerCase()
              });
            }
          });
        }
        return options;
      });
      
      // Store the quality options for later use
      if (qualityOptions && qualityOptions.length > 0) {
        this._lastQualityOptions = qualityOptions;
        logInfo('Scraper', `Found ${qualityOptions.length} quality options in the download page`);
      }
      
      // If we found subtitle options, store them
      let subtitleData = undefined;
      if (subtitleOptions && subtitleOptions.length > 0) {
        subtitleData = subtitleOptionsToStringArray(subtitleOptions);
        logInfo('Scraper', `Found ${subtitleOptions.length} subtitle options in the download page`);
      }
      
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
        quality: quality || 'HD',
        qualityOptions: this._lastQualityOptions.length > 0 ? 
          qualityOptionsToStringArray(this._lastQualityOptions) : 
          undefined,
        subtitleOptions: subtitleData // Use the subtitleData we generated earlier
      };
    } catch (error) {
      logError('Scraper', `Failed to extract video info: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to extract video information');
    }
  }

  /**
   * Refreshes the cache for a specific video
   * @param videoId - The ID of the video to refresh
   * @param season - Optional season number
   * @param episode - Optional episode number
   * @returns The freshly scraped video information
   */
  async refreshCache(videoId: string, season?: string | number, episode?: string | number): Promise<InsertVideo> {
    if (!this.storage) {
      throw new Error('Storage not initialized. Call setStorage first.');
    }
    
    // Create the appropriate cache key
    const cacheKey = season && episode 
      ? `${videoId}_s${season}_e${episode}` 
      : videoId;
    
    // Remove from cache using the appropriate key
    videoCache.del(cacheKey);
    
    // If it's a base videoId with no season/episode, also clear any season/episode variants
    if (!season && !episode) {
      // Get all keys from cache
      const keys = videoCache.keys();
      
      // Find and delete any keys that start with this videoId (season/episode variants)
      const variantPattern = new RegExp(`^${videoId}_s`);
      keys.forEach(key => {
        if (variantPattern.test(key)) {
          videoCache.del(key);
          logInfo('Cache', `Also cleared season/episode variant: ${key}`);
        }
      });
    }
    
    // Re-scrape with the appropriate parameters
    const freshVideo = await this.scrapeVideo(videoId, season, episode);
    
    // Update in database (base video entry only)
    await this.storage.updateVideo(videoId, freshVideo.url);
    
    logInfo('Cache', `Refreshed cache for: ${cacheKey}`);
    
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

export const videoScraper = new WovIeX();