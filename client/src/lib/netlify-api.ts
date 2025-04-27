/**
 * This file provides API functions specifically for Netlify deployment
 * It will use Netlify Functions instead of the regular Express backend
 */

// Base URL for API requests - in Netlify, we use the .netlify/functions/api path
const API_BASE = '/.netlify/functions/api';

/**
 * Utility function to make API requests to Netlify Functions
 */
export async function netlifyApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Ensure proper content type for JSON requests
  if (options.body && !options.headers) {
    options.headers = {
      'Content-Type': 'application/json',
    };
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json() as T;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Get recent videos
 */
export async function getRecentVideos() {
  return netlifyApiRequest('/videos');
}

/**
 * Get active domains
 */
export async function getActiveDomains() {
  return netlifyApiRequest('/domains');
}

/**
 * Get a video by its ID
 */
export async function getVideoById(videoId: string) {
  return netlifyApiRequest(`/videos/${videoId}`);
}

/**
 * Request a video URL to be scraped
 */
export async function scrapeVideo(videoId: string) {
  return netlifyApiRequest('/scrape', {
    method: 'POST',
    body: JSON.stringify({ videoId }),
  });
}

// Add more API functions as needed for your Netlify deployment