import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoScraper } from "./scraper";
import { telegramBot } from "./telegram";
import { verifyOrigin, getSystemStats, embedProtectionMiddleware } from "./utils";
import { z } from "zod";
import { insertDomainSchema, insertLogSchema } from "@shared/schema";
import { authMiddleware, loginAdmin } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
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
      
      // Return a full HTML page with Plyr.io player
      return res.send(`
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
            }
            video {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <video id="player" playsinline controls>
            <source src="${video.url}" type="video/mp4">
          </video>
          
          <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const player = new Plyr('#player', {
                fullscreen: { enabled: true, fallback: true, iosNative: true },
                controls: [
                  'play-large', 'play', 'progress', 'current-time', 'mute', 
                  'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
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
      `);
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
      
      // Return a full HTML page with Plyr.io player (using the same player template)
      return res.send(`
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
            }
            video {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <video id="player" playsinline controls>
            <source src="${video.url}" type="video/mp4">
          </video>
          
          <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const player = new Plyr('#player', {
                fullscreen: { enabled: true, fallback: true, iosNative: true },
                controls: [
                  'play-large', 'play', 'progress', 'current-time', 'mute', 
                  'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
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
      `);
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
    
    try {
      const video = await videoScraper.refreshCache(id);
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
  app.get('/api/telegram/status', async (req, res) => {
    try {
      const isActive = telegramBot.isActive();
      
      return res.json({ 
        success: true, 
        data: { 
          active: isActive,
          botToken: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.length > 10)
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
    telegramBot.start().then(() => {
      // Disable channel storage for now to prevent errors
      telegramBot.disableChannelStorage();
      console.log('Telegram channel storage is disabled to prevent errors');
      
      /* Temporarily disabled to prevent errors
      if (process.env.TELEGRAM_CHANNEL_ID) {
        console.log('Enabling Telegram channel database with ID:', process.env.TELEGRAM_CHANNEL_ID);
        telegramBot.enableChannelStorage(process.env.TELEGRAM_CHANNEL_ID);
      }
      */
    }).catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });
  } else {
    console.log('Telegram bot token not found or invalid. Bot will not start automatically.');
  }

  return httpServer;
}
