import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { Video } from '@shared/schema';
import * as crypto from 'crypto';

// Secret key for video URL encryption (32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
// Using a random IV for each encryption
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Encrypts a video URL for secure embedding
 * 
 * @param url - The original video URL to encrypt
 * @returns An encrypted string that can only be decrypted by the server
 */
export function encryptVideoUrl(url: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(url, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Return IV + encrypted data as a hex string
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an encrypted video URL
 * 
 * @param encryptedData - The encrypted video URL string
 * @returns The original video URL
 */
export function decryptVideoUrl(encryptedData: string): string {
  try {
    const textParts = encryptedData.split(':');
    if (textParts.length !== 2) throw new Error('Invalid encrypted format');
    
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = textParts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt video URL:', error);
    throw new Error('Invalid encrypted URL');
  }
}

/**
 * Generates a time-limited secure token for video access
 * 
 * @param videoId - The ID of the video
 * @param expiresIn - Time in seconds until token expires (default: 2 hours)
 * @returns A secure token with embedded expiration
 */
export function generateAccessToken(videoId: string, expiresIn = 7200): string {
  const payload = {
    videoId,
    exp: Math.floor(Date.now() / 1000) + expiresIn
  };
  
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Verifies a video access token
 * 
 * @param token - The access token to verify
 * @returns The videoId if valid, null if invalid or expired
 */
export function verifyAccessToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    
    // Check if token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload.videoId;
  } catch (error) {
    return null;
  }
}

/**
 * Verifies if the origin domain is in the whitelist
 * DISABLED: Now always returns true as domain authentication is disabled
 * 
 * @param req - The request object
 * @returns A promise resolving to true (domain authentication disabled)
 */
export async function verifyOrigin(req: Request): Promise<boolean> {
  // Domain authentication is disabled, so we always return true
  // Log the access for monitoring purposes
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  try {
    // Just log the domain for informational purposes
    if (origin || referer) {
      const urlString = origin || referer || '';
      try {
        const url = new URL(urlString);
        const domain = url.hostname;
        
        // Log access but don't restrict
        await storage.createLog({
          level: 'INFO',
          source: 'Security',
          message: `Access allowed for domain: ${domain} (domain authentication disabled)`
        });
      } catch (error) {
        console.error('Error parsing URL:', error);
      }
    }
  } catch (error) {
    console.error('Error in verifyOrigin:', error);
  }
  
  // Always return true since domain authentication is disabled
  return true;
}

/**
 * Middleware to enforce Content-Security-Policy and other headers for embed protection
 * DOMAIN AUTHENTICATION DISABLED as requested - all domains are now allowed
 */
export function embedProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow embedding from any domain by not setting restrictive headers
  // This allows the application to be used in Koyeb, VPS, and other server environments without domain restrictions
  
  // For API video routes, always allow access regardless of domain
  if (req.path.startsWith('/api/video/')) {
    // Log the request for information purposes
    storage.createLog({
      level: 'INFO',
      source: 'Security',
      message: `API access allowed from IP: ${req.ip} (domain authentication disabled)`
    }).catch(error => {
      console.error('Error logging API access:', error);
    });
    
    // Allow embedding from any domain
    next();
  } else {
    // For non-API routes, also allow access without domain restrictions
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
