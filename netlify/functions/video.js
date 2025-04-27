/**
 * Netlify Serverless Function for handling video API endpoints
 * 
 * This function serves as a serverless backend for the WovIeX application on Netlify,
 * handling requests for video information and processing.
 */

const { default: axios } = require('axios');

// Initialize scraperSettings with default values
const scraperSettings = {
  timeout: 30,
  autoRetry: true,
  cacheEnabled: true,
  cacheTTL: 1440 // 24 hours in minutes
};

// Simple in-memory cache (will reset on function cold starts)
const videoCache = new Map();

/**
 * Get a timestamp for cache expiration based on TTL
 * @returns {number} Timestamp for when the cache entry should expire
 */
function getExpirationTime() {
  return Date.now() + (scraperSettings.cacheTTL * 60 * 1000);
}

/**
 * Check if a cache entry is still valid
 * @param {Object} cacheEntry - The cache entry to check
 * @returns {boolean} Whether the cache entry is still valid
 */
function isCacheValid(cacheEntry) {
  return cacheEntry && cacheEntry.expires > Date.now();
}

/**
 * Scrape video information from the source
 * @param {string} videoId - The ID of the video to scrape
 * @param {string} season - Optional season number
 * @param {string} episode - Optional episode number
 * @returns {Promise<Object>} - Video information
 */
async function scrapeVideo(videoId, season, episode) {
  try {
    // This is where we would integrate with the actual scraper
    // For Netlify serverless functions, we'll need to use HTTP-based scraping
    
    const sourceUrl = generateSourceUrl(videoId, season, episode);
    
    // Perform HTTP scraping (simplified example)
    const response = await axios.get(sourceUrl, {
      timeout: scraperSettings.timeout * 1000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Extract video URL and other information (simplified for example)
    const videoInfo = {
      videoId,
      url: extractVideoUrl(response.data),
      title: extractTitle(response.data),
      season: season || null,
      episode: episode || null,
      accessCount: 1,
      qualityOptions: extractQualityOptions(response.data),
      subtitleOptions: extractSubtitleOptions(response.data),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return videoInfo;
  } catch (error) {
    console.error('Error scraping video:', error.message);
    throw new Error('Failed to scrape video: ' + error.message);
  }
}

/**
 * Helper function to generate source URL
 * This would be replaced with actual implementation
 */
function generateSourceUrl(videoId, season, episode) {
  // Replace with actual source URL generation logic
  let url = `https://example.com/embed/${videoId}`;
  
  if (season && episode) {
    url += `/season/${season}/episode/${episode}`;
  }
  
  return url;
}

/**
 * Helper functions to extract information from response
 * These would be replaced with actual implementation
 */
function extractVideoUrl(html) {
  // Replace with actual extraction logic
  return 'https://example.com/video.mp4';
}

function extractTitle(html) {
  // Replace with actual extraction logic
  return 'Video Title';
}

function extractQualityOptions(html) {
  // Replace with actual extraction logic
  return [
    { label: '720p', url: 'https://example.com/video-720p.mp4' },
    { label: '480p', url: 'https://example.com/video-480p.mp4' },
    { label: '360p', url: 'https://example.com/video-360p.mp4' }
  ];
}

function extractSubtitleOptions(html) {
  // Replace with actual extraction logic
  return [
    { label: 'English', url: 'https://example.com/subtitles-en.vtt', language: 'en' },
    { label: 'Spanish', url: 'https://example.com/subtitles-es.vtt', language: 'es' }
  ];
}

/**
 * Get video information with optional caching
 * @param {string} videoId - The ID of the video to get
 * @param {string} season - Optional season number
 * @param {string} episode - Optional episode number
 * @returns {Promise<Object>} - Video information
 */
async function getVideo(videoId, season, episode) {
  const cacheKey = `${videoId}${season ? '_s' + season : ''}${episode ? '_e' + episode : ''}`;
  
  // Check cache if enabled
  if (scraperSettings.cacheEnabled) {
    const cachedVideo = videoCache.get(cacheKey);
    if (isCacheValid(cachedVideo)) {
      // Increment access count
      cachedVideo.data.accessCount += 1;
      return cachedVideo.data;
    }
  }
  
  // If not in cache or cache is invalid, scrape the video
  const videoInfo = await scrapeVideo(videoId, season, episode);
  
  // Store in cache if caching is enabled
  if (scraperSettings.cacheEnabled) {
    videoCache.set(cacheKey, {
      data: videoInfo,
      expires: getExpirationTime()
    });
  }
  
  return videoInfo;
}

/**
 * Clear the video cache
 */
function clearCache() {
  videoCache.clear();
  return { success: true, message: 'Cache cleared successfully' };
}

/**
 * Update scraper settings
 * @param {Object} settings - New settings to apply
 * @returns {Object} - Updated settings
 */
function updateSettings(settings) {
  // Update only the properties that are provided
  if (settings.timeout !== undefined) scraperSettings.timeout = settings.timeout;
  if (settings.autoRetry !== undefined) scraperSettings.autoRetry = settings.autoRetry;
  if (settings.cacheEnabled !== undefined) scraperSettings.cacheEnabled = settings.cacheEnabled;
  if (settings.cacheTTL !== undefined) scraperSettings.cacheTTL = settings.cacheTTL;
  
  return { ...scraperSettings };
}

/**
 * Netlify function handler
 */
exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  try {
    const path = event.path.replace('/.netlify/functions/video', '');
    const segments = path.split('/').filter(Boolean);
    const method = event.httpMethod;
    
    // Handle different API endpoints
    
    // GET /api/video/:id
    if (method === 'GET' && segments[0] === 'api' && segments[1] === 'video' && segments[2]) {
      const videoId = segments[2];
      const params = new URLSearchParams(event.queryStringParameters || {});
      const season = params.get('season');
      const episode = params.get('episode');
      
      const video = await getVideo(videoId, season, episode);
      
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: video })
      };
    }
    
    // POST /api/cache/clear
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'cache' && segments[2] === 'clear') {
      const result = clearCache();
      
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: result })
      };
    }
    
    // POST /api/settings
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'settings') {
      const body = JSON.parse(event.body || '{}');
      const updatedSettings = updateSettings(body);
      
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: updatedSettings })
      };
    }
    
    // GET /api/settings
    if (method === 'GET' && segments[0] === 'api' && segments[1] === 'settings') {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: scraperSettings })
      };
    }
    
    // Handle unknown endpoints
    return {
      statusCode: 404,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};