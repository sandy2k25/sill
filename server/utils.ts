import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { Video } from '@shared/schema';

/**
 * Verifies if the origin domain is in the whitelist
 * 
 * @param req - The request object
 * @returns A promise resolving to a boolean indicating if the domain is whitelisted
 */
export async function verifyOrigin(req: Request): Promise<boolean> {
  // Get origin from request
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  // If neither origin nor referer, it's likely a direct API call - allow
  if (!origin && !referer) {
    return true;
  }
  
  try {
    // Parse the origin/referer to get the domain
    const urlString = origin || referer || '';
    const url = new URL(urlString);
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
 * Middleware to enforce Content-Security-Policy and other headers for embed protection
 */
export function embedProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Set security headers to prevent embedding on non-whitelisted domains
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Get referer from request
  const referer = req.get('referer');
  
  // If direct access (no referer), allow
  if (!referer) {
    next();
    return;
  }
  
  // Check referer domain
  try {
    const url = new URL(referer);
    const domain = url.hostname;
    
    // Check if domain is whitelisted asynchronously
    storage.isDomainWhitelisted(domain)
      .then(isWhitelisted => {
        if (isWhitelisted) {
          // For whitelisted domains, allow embedding
          res.removeHeader('X-Frame-Options');
          next();
        } else {
          // For non-whitelisted domains, send embed protection script
          // This script will break out of frames for non-whitelisted domains
          const embedProtectionScript = `
            <script>
              // If we're in an iframe and parent domain is not whitelisted
              if (window.self !== window.top) {
                // Break out of the iframe
                window.top.location.href = window.location.href;
              }
            </script>
          `;
          
          // Only inject script for HTML responses
          const originalSend = res.send;
          res.send = function(body) {
            // Only inject for HTML responses
            if (typeof body === 'string' && body.includes('<!DOCTYPE html>') || body.includes('<html')) {
              // Insert script right after head tag
              body = body.replace('<head>', '<head>' + embedProtectionScript);
            }
            
            return originalSend.call(this, body);
          };
          
          next();
        }
      })
      .catch(error => {
        console.error('Error in embed protection middleware:', error);
        next();
      });
  } catch (error) {
    // If there's an error parsing the referer, continue
    next();
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
  const totalAccesses = recentVideos.reduce((sum, video) => sum + (video.accessCount || 0), 0);
  
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
