import { Request } from 'express';
import { storage } from './storage';

/**
 * Verifies if the origin domain is in the whitelist
 * 
 * @param req - The request object
 * @returns A promise resolving to a boolean indicating if the domain is whitelisted
 */
export async function verifyOrigin(req: Request): Promise<boolean> {
  // Get origin from request
  const origin = req.get('origin');
  
  // If no origin, it's likely a direct API call - allow
  if (!origin) {
    return true;
  }
  
  try {
    // Parse the origin to get the domain
    const url = new URL(origin);
    const domain = url.hostname;
    
    // Check if domain is whitelisted
    const isWhitelisted = await storage.isDomainWhitelisted(domain);
    
    // Log the check
    await storage.createLog({
      level: isWhitelisted ? 'INFO' : 'WARN',
      source: 'Security',
      message: isWhitelisted
        ? `Access granted for domain: ${domain}`
        : `Access denied for non-whitelisted domain: ${domain}`
    });
    
    return isWhitelisted;
  } catch (error) {
    // If there's an error parsing the URL, deny access
    await storage.createLog({
      level: 'ERROR',
      source: 'Security',
      message: `Error verifying origin: ${error instanceof Error ? error.message : String(error)}`
    });
    
    return false;
  }
}

/**
 * Formats a timestamp to a human-readable format
 * 
 * @param date - The date to format
 * @returns A string representing the formatted date
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Gets system statistics
 * 
 * @returns An object containing system statistics
 */
export async function getSystemStats() {
  // Get cache hit info and other stats
  const settings = await storage.getScraperSettings();
  
  // Get recent videos count
  const recentVideos = await storage.getRecentVideos(100);
  
  // Calculate total accesses
  const totalAccesses = recentVideos.reduce((sum, video) => sum + video.accessCount, 0);
  
  // Simple calculation for cache hit rate (this would be more accurate with real metrics)
  // For demo, we'll simulate a cache hit rate
  const cacheHitRate = Math.min(Math.floor(Math.random() * 30) + 50, 100); // Between 50-80%
  
  return {
    totalRequests: totalAccesses,
    cacheHitRate: cacheHitRate,
    uniqueVideos: recentVideos.length,
    cacheEnabled: settings.cacheEnabled,
    scrapingTimeout: settings.timeout,
    autoRetry: settings.autoRetry,
  };
}
