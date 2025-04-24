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
    // Skip origin check for specific paths
    const allowedPaths = ['/api/auth/login', '/api/video', '/api/videos/recent'];
    const isExemptPath = allowedPaths.some(path => req.path.startsWith(path));
    
    if (!isExemptPath) {
      const isAllowed = await verifyOrigin(req);
      
      if (!isAllowed) {
        return res.status(403).json({ 
          error: 'Access denied: Origin not whitelisted' 
        });
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
  
  // fulltaah/id - Full-page embed with Plyr.io player
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
  
  app.post('/api/logs', async (req, res) => {
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
  
  app.delete('/api/logs', async (req, res) => {
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
          botToken: !!process.env.TELEGRAM_BOT_TOKEN
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  });
  
  app.post('/api/telegram/start', async (req, res) => {
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
  
  app.post('/api/telegram/stop', async (req, res) => {
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
  
  // Initialize Telegram bot at startup
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.start().catch(error => {
      console.error('Failed to start Telegram bot:', error);
    });
  }

  return httpServer;
}
