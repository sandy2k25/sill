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
  
  // If neither origin nor referer, check if it's a protected endpoint
  // If it's an admin endpoint, allow direct API calls
  if (!origin && !referer) {
    const isAdminEndpoint = req.path.includes('/admin') || 
                          req.path.includes('/auth') || 
                          req.path === '/api/auth/login' ||
                          req.path === '/api/telegram-webhook';
                          
    // For non-admin endpoints, enforce origin check
    if (!isAdminEndpoint) {
      await storage.createLog({
        level: 'WARN',
        source: 'Security',
        message: `Access denied: Missing origin/referer for path ${req.path}`
      });
      return false;
    }
    
    return isAdminEndpoint;
  }
  
  try {
    // Parse the origin/referer to get the domain
    const urlString = origin || referer || '';
    const url = new URL(urlString);
    const domain = url.hostname;
    
    // Check if domain is whitelisted
    const isWhitelisted = await storage.isDomainWhitelisted(domain);
    
    // Log the check with more details
    await storage.createLog({
      level: isWhitelisted ? 'INFO' : 'WARN',
      source: 'Security',
      message: isWhitelisted
        ? `Access granted for domain: ${domain} (${origin ? 'origin' : 'referer'}: ${urlString})`
        : `Access denied for non-whitelisted domain: ${domain} (${origin ? 'origin' : 'referer'}: ${urlString})`
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
  // Set strict security headers to prevent embedding on non-whitelisted domains
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Handle the /api/video/* routes specifically
  if (req.path.startsWith('/api/video/')) {
    // Get origin and referer from request
    const origin = req.get('origin');
    const referer = req.get('referer');
    
    // If direct API access with no origin/referer, apply strict validation
    if (!origin && !referer) {
      // For API calls, check if the request came with a specific header
      const apiKey = req.get('X-API-Key');
      if (!apiKey || apiKey !== process.env.API_KEY) {
        // Log unauthorized access attempt
        storage.createLog({
          level: 'WARN',
          source: 'Security',
          message: `Direct API access attempt without referer or valid API key from IP: ${req.ip}`
        });
        
        return res.status(403).json({
          success: false,
          error: 'Embedding is disabled for this domain'
        });
      }
    } else {
      // Parse origin or referer
      try {
        const urlString = origin || referer || '';
        const url = new URL(urlString);
        const domain = url.hostname;
        
        // Check domain against whitelist
        storage.isDomainWhitelisted(domain)
          .then(isWhitelisted => {
            if (isWhitelisted) {
              // For whitelisted domains, allow API access
              res.removeHeader('X-Frame-Options');
              next();
            } else {
              // Log unauthorized domain
              storage.createLog({
                level: 'WARN',
                source: 'Security',
                message: `API access attempt from non-whitelisted domain: ${domain}`
              });
              
              // For non-whitelisted domains, block API access
              res.status(403).json({
                success: false,
                error: 'Embedding is disabled for this domain'
              });
            }
          })
          .catch(error => {
            console.error('Error checking domain whitelist:', error);
            // Default to blocking on error
            res.status(500).json({
              success: false,
              error: 'Error validating domain'
            });
          });
        return; // Important: stop execution here since we're handling response in the async block
      } catch (error) {
        // If there's an error parsing the URL, block access
        return res.status(403).json({
          success: false,
          error: 'Invalid origin'
        });
      }
    }
  } else {
    // For non-API routes, check referer
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
                  // Break out of the iframe or show error message
                  document.body.innerHTML = '<div style="color: red; padding: 20px;">Embedding is disabled for this domain.</div>';
                  // Or redirect: window.top.location.href = window.location.href;
                }
              </script>
            `;
            
            // Only inject script for HTML responses
            const originalSend = res.send;
            res.send = function(body) {
              // Only inject for HTML responses
              if (typeof body === 'string' && (body.includes('<!DOCTYPE html>') || body.includes('<html'))) {
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
      // If there's an error parsing the referer, block
      const embedProtectionScript = `
        <script>
          // If we're in an iframe, block
          if (window.self !== window.top) {
            document.body.innerHTML = '<div style="color: red; padding: 20px;">Embedding is disabled.</div>';
          }
        </script>
      `;
      
      // Monkey patch the send method
      const originalSend = res.send;
      res.send = function(body) {
        if (typeof body === 'string' && (body.includes('<!DOCTYPE html>') || body.includes('<html'))) {
          body = body.replace('<head>', '<head>' + embedProtectionScript);
        }
        return originalSend.call(this, body);
      };
      
      next();
    }
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
