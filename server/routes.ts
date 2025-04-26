import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoScraper } from "./scraper";
import { telegramBot } from "./telegram";
import { verifyOrigin, getSystemStats, embedProtectionMiddleware, encryptVideoUrl, decryptVideoUrl, generateAccessToken, verifyAccessToken } from "./utils";
import { z } from "zod";
import { insertDomainSchema, insertLogSchema } from "@shared/schema";
import { authMiddleware, loginAdmin } from "./auth";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Stream endpoint for securely serving video content
  app.get('/stream/:token', (req, res) => {
    const token = req.params.token;
    const range = req.headers.range;
    
    try {
      // Decrypt the token to get the video URL
      const videoUrl = decryptVideoUrl(token);
      
      if (!videoUrl) {
        return res.status(403).send('Invalid or expired video access token');
      }
      
      // Parse the URL to prepare for the request
      const parsedUrl = new URL(videoUrl);
      
      // Options for HEAD request to get content info
      const headOptions = {
        method: 'HEAD',
        host: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      };
      
      // Make HEAD request to get content info
      const headReq = https.request(headOptions, (headRes) => {
        if (headRes.statusCode !== 200) {
          res.status(headRes.statusCode || 500).send('Unable to access video content');
          return;
        }
        
        // Get content info
        const contentLength = Number(headRes.headers['content-length'] || '0');
        const contentType = headRes.headers['content-type'] || 'video/mp4';
        
        // Options for GET request (for actual content)
        const getOptions: https.RequestOptions = {
          method: 'GET',
          host: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        };
        
        // If range request, handle partial content (streaming)
        if (range) {
          // Parse range
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
          const chunkSize = end - start + 1;
          
          // Add range header to options
          if (!getOptions.headers) getOptions.headers = {};
          getOptions.headers['Range'] = `bytes=${start}-${end}`;
          
          // Fetch the proper chunk
          const videoReq = https.request(getOptions, (videoRes) => {
            // Ensure proper status code and headers for range requests
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', chunkSize);
            res.setHeader('Content-Type', contentType);
            
            // Pipe the video response to the client response
            videoRes.pipe(res);
          });
          
          videoReq.on('error', (error) => {
            console.error('Error streaming video chunk:', error);
            res.status(500).send('Error streaming video content');
          });
          
          videoReq.end();
        } else {
          // No range requested, serve the whole file
          res.setHeader('Content-Length', contentLength);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Accept-Ranges', 'bytes');
          
          // Fetch the entire video
          const videoReq = https.request(getOptions, (videoRes) => {
            // Pipe the video response to the client response
            videoRes.pipe(res);
          });
          
          videoReq.on('error', (error) => {
            console.error('Error streaming full video:', error);
            res.status(500).send('Error streaming video content');
          });
          
          videoReq.end();
        }
      });
      
      headReq.on('error', (error) => {
        console.error('Error getting video info:', error);
        res.status(500).send('Error streaming video content');
      });
      
      headReq.end();
    } catch (error) {
      console.error('Streaming error:', error);
      res.status(500).send('Error streaming video content');
    }
  });
  
  // Middleware to check origin for all API routes
  app.use('/api', async (req, res, next) => {
    // For development environment, we always allow access
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // Skip origin check for specific paths - these are publicly accessible
    const allowedPaths = ['/api/auth/login', '/api/video', '/api/videos/recent'];
    const isExemptPath = allowedPaths.some(path => req.path.startsWith(path));
    
    if (!isExemptPath) {
      // Only check origins if the request has an origin or referer header
      // This allows direct API access from the browser when not embedded
      const origin = req.get('origin');
      const referer = req.get('referer');
      
      if (origin || referer) {
        const isAllowed = await verifyOrigin(req);
        
        if (!isAllowed) {
          return res.status(403).json({ 
            error: 'Access denied: Origin not whitelisted' 
          });
        }
      }
    }
    
    next();
  });
  
  // Admin authentication routes
  app.post('/api/auth/login', loginAdmin);
  
  // API endpoint to get a video URL
  app.get('/api/video/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const video = await videoScraper.scrapeVideo(id);
      return res.json({ 
        success: true, 
        data: video 
      });
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'API',
        message: `Error fetching video ${id}: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Create shorthand endpoints for display and playback
  // tahh/id - URL extraction endpoint
  app.get('/tahh/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const video = await videoScraper.scrapeVideo(id);
      return res.redirect(video.url);
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'API',
        message: `Error redirecting to video ${id}: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'An unknown error occurred'}</p>
            <a href="/">Go Back</a>
          </body>
        </html>
      `);
    }
  });
  
  // taah/id - Video player endpoint - handled by React router
  // We'll implement this using React routing
  
  // fulltaah/id - Full-page embed with Plyr.io player (original format)
  app.get('/fulltaah/:id', embedProtectionMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
      const video = await videoScraper.scrapeVideo(id);
      
      // Check if we have a valid title and URL
      if (!video.url) {
        throw new Error('Failed to get video URL');
      }

      // Increment access count
      await storage.incrementAccessCount(id);
      
      // Load the player template and replace variables
      // Using our imported fs and path modules
      
      try {
        // Read the player template file
        const templatePath = path.join(process.cwd(), 'player_template.html');
        let playerTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Replace variables in the template
        playerTemplate = playerTemplate.replace(/\$\{video\.url\}/g, streamUrl);
        playerTemplate = playerTemplate.replace(/\$\{video\.title[^}]*\}/g, video.title || 'Video Player');
        playerTemplate = playerTemplate.replace(/\$\{video\.quality[^}]*\}/g, video.quality || 'HD');
        
        return res.send(playerTemplate);
      } catch (templateError) {
        console.error('Template error:', templateError);
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Fallback to simple player if template fails
        const fallbackHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${video.title || 'Video Player'}</title>
          <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: #000;
            }
            .plyr {
              height: 100%;
              --plyr-color-main: #e5308c;
            }
            video {
              width: 100%;
              height: 100%;
            }
            .wovie-logo {
              position: absolute;
              top: 10px;
              right: 10px;
              color: white;
              font-family: Arial, sans-serif;
              font-weight: bold;
              font-size: 16px;
              z-index: 99;
              background-color: rgba(0, 0, 0, 0.5);
              padding: 5px 10px;
              border-radius: 5px;
              pointer-events: none;
              text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            }
          </style>
        </head>
        <body>
          <div class="wovie-logo">WovIe Player</div>
          <video id="player" playsinline controls>
            <source src="${streamUrl}" type="video/mp4">
          </video>
          
          <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const player = new Plyr('#player', {
                fullscreen: { enabled: true, fallback: true, iosNative: true },
                controls: [
                  'play-large', 'rewind', 'play', 'fast-forward', 'progress', 
                  'current-time', 'duration', 'mute', 'volume', 'settings', 
                  'pip', 'airplay', 'fullscreen'
                ],
              });
              
              // Auto-play when loaded
              player.on('ready', () => {
                player.play();
              });
            });
          </script>
        </body>
        </html>
        `;
        return res.send(fallbackHtml);
      }
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'API',
        message: `Error serving player for video ${id}: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'An unknown error occurred'}</p>
            <a href="/">Go Back</a>
          </body>
        </html>
      `);
    }
  });
  
  // New format: fulltaah/{seasonid}/{episodeid}/{id} - Full-page embed with Plyr.io player
  app.get('/fulltaah/:seasonid/:episodeid/:id', embedProtectionMiddleware, async (req, res) => {
    const { seasonid, episodeid, id } = req.params;
    
    try {
      // Call scrapeVideo with season and episode parameters
      const video = await videoScraper.scrapeVideo(id, seasonid, episodeid);
      
      // Check if we have a valid title and URL
      if (!video.url) {
        throw new Error('Failed to get video URL');
      }

      // Increment access count
      await storage.incrementAccessCount(id);
      
      // Log the access with the additional parameters
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: `Serving video ${id} with season ${seasonid}, episode ${episodeid}`
      });
      
      // Load the player template and replace variables
      // Using our imported fs and path modules
      
      try {
        // Read the player template file
        const templatePath = path.join(process.cwd(), 'player_template.html');
        let playerTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Add season and episode to the title for this route
        const seasonEpisodeInfo = ` S${seasonid} E${episodeid}`;
        const titleWithSeasonEp = video.title ? `${video.title}${seasonEpisodeInfo}` : `Video Player${seasonEpisodeInfo}`;
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Replace variables in the template
        playerTemplate = playerTemplate.replace(/\$\{video\.url\}/g, streamUrl);
        playerTemplate = playerTemplate.replace(/\$\{video\.title[^}]*\}/g, titleWithSeasonEp);
        playerTemplate = playerTemplate.replace(/\$\{video\.quality[^}]*\}/g, video.quality || 'HD');
        
        return res.send(playerTemplate);
      } catch (templateError) {
        console.error('Template error:', templateError);
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Fallback to simple player if template fails
        const fallbackHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${video.title || 'Video Player'}</title>
          <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: #000;
            }
            .plyr {
              height: 100%;
              --plyr-color-main: #e5308c;
            }
            video {
              width: 100%;
              height: 100%;
            }
            .wovie-logo {
              position: absolute;
              top: 10px;
              right: 10px;
              color: white;
              font-family: Arial, sans-serif;
              font-weight: bold;
              font-size: 16px;
              z-index: 99;
              background-color: rgba(0, 0, 0, 0.5);
              padding: 5px 10px;
              border-radius: 5px;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="wovie-logo">WovIe Player</div>
          <video id="player" playsinline controls>
            <source src="${streamUrl}" type="video/mp4">
          </video>
          
          <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const player = new Plyr('#player', {
                fullscreen: { enabled: true, fallback: true, iosNative: true },
                controls: [
                  'play-large', 'rewind', 'play', 'fast-forward', 'progress', 
                  'current-time', 'duration', 'mute', 'volume', 'settings', 
                  'pip', 'airplay', 'fullscreen'
                ],
              });
              
              // Auto-play when loaded
              player.on('ready', () => {
                player.play();
              });
            });
          </script>
        </body>
        </html>
        `;
        return res.send(fallbackHtml);
      }
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'API',
        message: `Error serving player for video ${id} with season ${seasonid}, episode ${episodeid}: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'An unknown error occurred'}</p>
            <a href="/">Go Back</a>
          </body>
        </html>
      `);
    }
  });
  
  // API endpoint to get recent videos
  app.get('/api/videos/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const videos = await storage.getRecentVideos(limit);
      return res.json({ 
        success: true, 
        data: videos 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Cache management endpoints
  app.post('/api/cache/clear', authMiddleware, async (req, res) => {
    try {
      await videoScraper.clearCache();
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: 'Cache cleared via API'
      });
      
      return res.json({ 
        success: true, 
        message: 'Cache cleared successfully' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/cache/refresh/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { season, episode } = req.body; // Optional parameters for season/episode
    
    try {
      const video = await videoScraper.refreshCache(id, season, episode);
      return res.json({ 
        success: true, 
        data: video 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Another endpoint specifically for season/episode refresh requests
  app.post('/api/cache/refresh/:id/:season/:episode', authMiddleware, async (req, res) => {
    const { id, season, episode } = req.params;
    
    try {
      const video = await videoScraper.refreshCache(id, season, episode);
      return res.json({ 
        success: true, 
        data: video 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Settings management
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getScraperSettings();
      return res.json({ 
        success: true, 
        data: settings 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.put('/api/settings', authMiddleware, async (req, res) => {
    try {
      const settings = req.body;
      
      // Validate settings
      const settingsSchema = z.object({
        timeout: z.number().int().min(5).max(120).optional(),
        autoRetry: z.boolean().optional(),
        cacheEnabled: z.boolean().optional(),
        cacheTTL: z.number().int().min(60).max(86400).optional() // 1 minute to 1 day
      });
      
      const validatedSettings = settingsSchema.parse(settings);
      
      // Update settings in scraper and storage
      await videoScraper.updateSettings(validatedSettings);
      
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: 'Settings updated via API'
      });
      
      // Return updated settings
      const updatedSettings = await storage.getScraperSettings();
      return res.json({ 
        success: true, 
        data: updatedSettings 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Domain whitelist management
  app.get('/api/domains', async (req, res) => {
    try {
      const domains = await storage.getAllDomains();
      return res.json({ 
        success: true, 
        data: domains 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/domains', authMiddleware, async (req, res) => {
    try {
      const validatedDomain = insertDomainSchema.parse(req.body);
      const domain = await storage.createDomain(validatedDomain);
      
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: `Domain ${domain.domain} added via API`
      });
      
      return res.json({ 
        success: true, 
        data: domain 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.put('/api/domains/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
      const domain = await storage.toggleDomainStatus(parseInt(id));
      
      if (!domain) {
        return res.status(404).json({ 
          success: false, 
          error: 'Domain not found' 
        });
      }
      
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: `Domain ${domain.domain} status toggled via API`
      });
      
      return res.json({ 
        success: true, 
        data: domain 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.delete('/api/domains/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
      const success = await storage.deleteDomain(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: 'Domain not found' 
        });
      }
      
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: `Domain ${id} deleted via API`
      });
      
      return res.json({ 
        success: true 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Logs management
  app.get('/api/logs', authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const level = req.query.level as string | undefined;
      
      const { logs, total } = await storage.getLogs(limit, offset, level);
      
      return res.json({ 
        success: true, 
        data: { logs, total } 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/logs', authMiddleware, async (req, res) => {
    try {
      const validatedLog = insertLogSchema.parse(req.body);
      const log = await storage.createLog(validatedLog);
      
      return res.json({ 
        success: true, 
        data: log 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.delete('/api/logs', authMiddleware, async (req, res) => {
    try {
      await storage.clearLogs();
      
      return res.json({ 
        success: true, 
        message: 'Logs cleared successfully' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // System stats
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await getSystemStats();
      return res.json({ 
        success: true, 
        data: stats 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Telegram bot management
  app.get('/api/telegram/status', authMiddleware, async (req, res) => {
    try {
      const isActive = telegramBot.isActive();
      const channelStorageEnabled = telegramBot.isChannelStorageEnabled();
      const channelId = telegramBot.getChannelId();
      
      return res.json({ 
        success: true, 
        data: { 
          active: isActive,
          botToken: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.length > 10),
          channelStorageEnabled: channelStorageEnabled,
          channelId: channelId
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/telegram/start', authMiddleware, async (req, res) => {
    try {
      await telegramBot.start();
      
      return res.json({ 
        success: true, 
        message: 'Telegram bot started' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/telegram/stop', authMiddleware, async (req, res) => {
    try {
      await telegramBot.stop();
      
      return res.json({ 
        success: true, 
        message: 'Telegram bot stopped' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Channel storage management endpoints
  app.post('/api/telegram/channel/enable', authMiddleware, async (req, res) => {
    try {
      const { channelId } = req.body;

      if (!channelId || typeof channelId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid channel ID is required' 
        });
      }
      
      if (!telegramBot.isActive()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Telegram bot must be running to enable channel storage' 
        });
      }

      telegramBot.enableChannelStorage(channelId);
      
      // Log the action
      await storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: `Channel storage enabled with ID: ${channelId}`
      });
      
      return res.json({ 
        success: true, 
        message: 'Channel storage enabled successfully' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/telegram/channel/disable', authMiddleware, async (req, res) => {
    try {
      telegramBot.disableChannelStorage();
      
      // Log the action
      await storage.createLog({
        level: 'INFO',
        source: 'Telegram',
        message: 'Channel storage disabled'
      });
      
      return res.json({ 
        success: true, 
        message: 'Channel storage disabled successfully' 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  // Telegram webhook endpoint for VPS/cloud services
  app.post('/api/telegram-webhook', (req, res) => {
    try {
      console.log('Received Telegram webhook request');
      
      // If the bot is active, process the update
      if (telegramBot.isActive() && telegramBot.getBot()) {
        const bot = telegramBot.getBot()!;
        
        // Use the Telegraf bot instance to handle the update
        bot.handleUpdate(req.body, res)
          .then(() => {
            // Response is already sent by handleUpdate
          })
          .catch(err => {
            console.error('Error handling Telegram update:', err);
            res.status(200).json({ ok: true, message: 'Error processing update' });
          });
      } else {
        console.log('Received webhook request but bot is not active');
        return res.status(200).json({ ok: true, message: 'Bot not active' });
      }
    } catch (error) {
      console.error('Error in Telegram webhook:', error);
      return res.status(200).json({ ok: true, message: 'Error processing webhook' });
    }
  });
  
  // Initialize Telegram bot at startup if token exists
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.length > 10) {
    console.log('Starting Telegram bot...');
    try {
      // Using async/await pattern with immediate function execution
      (async () => {
        try {
          await telegramBot.start();
          
          // Initialize with channel storage disabled
          telegramBot.disableChannelStorage();
          
          // If channel ID is provided as environment variable, enable channel storage
          if (process.env.TELEGRAM_CHANNEL_ID) {
            console.log('Enabling Telegram channel database with ID:', process.env.TELEGRAM_CHANNEL_ID);
            telegramBot.enableChannelStorage(process.env.TELEGRAM_CHANNEL_ID);
          } else {
            console.log('Telegram channel storage is disabled. Configure through admin panel.');
          }
        } catch (error) {
          console.error('Failed to start Telegram bot:', error);
        }
      })();
    } catch (error) {
      console.error('Error executing Telegram bot startup:', error);
    }
  } else {
    console.log('Telegram bot token not found or invalid. Bot will not start automatically.');
  }

  return httpServer;
}
