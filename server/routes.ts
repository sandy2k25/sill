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
      
      // Check if URL exists
      if (!video.url) {
        throw new Error('Failed to extract video URL');
      }
      
      // Log access
      await storage.createLog({
        level: 'INFO',
        source: 'API',
        message: `Redirecting to video ${id} via /tahh endpoint`
      }).catch(err => console.error('Failed to log access:', err));
      
      // Increment counter
      await storage.incrementAccessCount(id).catch(err => console.error('Failed to increment access count:', err));
      
      return res.redirect(video.url);
    } catch (error) {
      await storage.createLog({
        level: 'ERROR',
        source: 'API',
        message: `Error redirecting to video ${id}: ${error instanceof Error ? error.message : String(error)}`
      }).catch(err => console.error('Failed to log error:', err));
      
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
        // Read the simple player template file
        const templatePath = path.join(process.cwd(), 'player_template_simple.html');
        let playerTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Prepare quality options for the player
        let qualityOptionsArray = [];
        let selectedQuality = { label: video.quality || 'HD' };
        
        if (video.qualityOptions && Array.isArray(video.qualityOptions)) {
          try {
            qualityOptionsArray = video.qualityOptions.map(opt => {
              if (typeof opt === 'string') {
                try {
                  return JSON.parse(opt);
                } catch (e) {
                  return { label: 'Unknown', url: opt };
                }
              }
              return opt;
            });
            
            // Encrypt all stream URLs
            qualityOptionsArray = qualityOptionsArray.map(opt => {
              if (opt && opt.url) {
                const encryptedQualityUrl = encryptVideoUrl(opt.url);
                return { 
                  ...opt, 
                  url: `/stream/${encryptedQualityUrl}` 
                };
              }
              return opt;
            });
            
            // Find the highest quality option to use as selected
            if (qualityOptionsArray.length > 0) {
              // Try to find HD or highest available quality
              const hdOption = qualityOptionsArray.find(opt => 
                opt.label && (opt.label.includes('HD') || opt.label.includes('720p') || opt.label.includes('1080p'))
              );
              
              if (hdOption) {
                selectedQuality = hdOption;
              } else {
                // Sort by numeric part of quality label (e.g., 480p -> 480)
                qualityOptionsArray.sort((a, b) => {
                  const aNum = parseInt((a.label || '').replace(/[^\d]/g, '')) || 0;
                  const bNum = parseInt((b.label || '').replace(/[^\d]/g, '')) || 0;
                  return bNum - aNum; // Sort descending
                });
                
                // Use the first (highest) quality
                selectedQuality = qualityOptionsArray[0];
              }
            }
          } catch (qErr) {
            console.error('Error processing quality options:', qErr);
          }
        }
        
        // Prepare subtitle options for the player
        let subtitleOptionsArray = [];
        
        if (video.subtitleOptions && Array.isArray(video.subtitleOptions)) {
          try {
            subtitleOptionsArray = video.subtitleOptions.map(opt => {
              if (typeof opt === 'string') {
                try {
                  return JSON.parse(opt);
                } catch (e) {
                  return { label: 'Unknown', url: opt, language: 'en' };
                }
              }
              return opt;
            });
          } catch (sErr) {
            console.error('Error processing subtitle options:', sErr);
          }
        }
        
        // Create a data object with all video properties
        const videoData = {
          url: streamUrl,
          title: video.title || 'Video Player',
          quality: video.quality || 'HD',
          selectedQuality: selectedQuality,
          qualityOptions: qualityOptionsArray,
          subtitleOptions: subtitleOptionsArray
        };
        
        // Replace all template variables using Function constructor
        // This approach is safer for complex template variables
        playerTemplate = playerTemplate.replace(/\$\{([^}]+)\}/g, (match, expr) => {
          try {
            // Create a safe evaluation context with only the video object
            const result = new Function('video', `return ${expr};`)(videoData);
            return result !== undefined ? result : '';
          } catch (e) {
            console.error(`Failed to evaluate template expression: ${expr}`, e);
            return '';
          }
        });
        
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
            .video-title {
              position: absolute;
              top: 10px;
              left: 50%;
              transform: translateX(-50%);
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
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 60%;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="wovie-logo">WovIeX</div>
          <div class="video-title">${video.title || 'Video Player'}</div>
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
    
    console.log(`Received request for fulltaah with seasonid=${seasonid}, episodeid=${episodeid}, id=${id}`);
    
    try {
      console.log(`Attempting to scrape video ${id} with season ${seasonid}, episode ${episodeid}`);
      // Call scrapeVideo with season and episode parameters
      const video = await videoScraper.scrapeVideo(id, seasonid, episodeid);
      
      console.log(`Scraper results for ${id}: URL exists: ${Boolean(video.url)}, Title: ${video.title || 'None'}`);
      
      // Check if we have a valid title and URL
      if (!video.url) {
        console.error(`No URL found for video ${id}`);
        
        // Instead of throwing an error, show a server down animation
        return res.status(404).send(`
          <html>
            <head>
              <title>Server Down | WovIeX</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                
                body {
                  font-family: Arial, sans-serif;
                  background-color: #111;
                  color: white;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  overflow: hidden;
                  text-align: center;
                  padding: 20px;
                }
                
                .error-container {
                  max-width: 500px;
                  perspective: 1000px;
                }
                
                .server-animation {
                  width: 140px;
                  height: 200px;
                  margin: 0 auto 40px;
                  position: relative;
                  transform-style: preserve-3d;
                  animation: float 6s ease-in-out infinite;
                }
                
                .server {
                  width: 140px;
                  height: 200px;
                  position: absolute;
                  background: linear-gradient(45deg, #333, #222);
                  border-radius: 10px;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                  transform-style: preserve-3d;
                  transform: rotateY(0deg);
                  animation: server-shake 0.8s ease-in-out infinite;
                }
                
                .server-light {
                  position: absolute;
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  background-color: #ff4d4d;
                  top: 20px;
                  right: 20px;
                  box-shadow: 0 0 10px #ff4d4d;
                  animation: blink 1s infinite alternate;
                }
                
                .server-light:nth-child(2) {
                  top: 40px;
                  background-color: #ffcc00;
                  box-shadow: 0 0 10px #ffcc00;
                  animation-delay: 0.2s;
                }
                
                .server-light:nth-child(3) {
                  top: 60px;
                  background-color: #ff9933;
                  box-shadow: 0 0 10px #ff9933;
                  animation-delay: 0.3s;
                }
                
                .server-slots {
                  position: absolute;
                  width: 100px;
                  height: 15px;
                  background-color: #111;
                  border-radius: 3px;
                  top: 100px;
                  left: 20px;
                  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
                }
                
                .server-slots:nth-child(5) {
                  top: 125px;
                }
                
                .server-slots:nth-child(6) {
                  top: 150px;
                }
                
                .cloud {
                  position: absolute;
                  width: 60px;
                  height: 30px;
                  background-color: rgba(255, 255, 255, 0.1);
                  border-radius: 15px;
                  top: -40px;
                  left: 40px;
                  animation: cloud-move 4s ease-in-out infinite;
                }
                
                .cloud:after, .cloud:before {
                  content: '';
                  position: absolute;
                  width: 25px;
                  height: 25px;
                  border-radius: 50%;
                  background-color: rgba(255, 255, 255, 0.1);
                }
                
                .cloud:after {
                  top: -10px;
                  left: 10px;
                }
                
                .cloud:before {
                  top: -5px;
                  left: 30px;
                }
                
                .lightning {
                  position: absolute;
                  top: -10px;
                  left: 70px;
                  width: 3px;
                  height: 30px;
                  background-color: #ffff99;
                  transform: rotate(15deg);
                  opacity: 0;
                  animation: lightning 4s ease-in-out infinite;
                  z-index: -1;
                  box-shadow: 0 0 10px 2px #ffff99;
                }
                
                .error-title {
                  font-size: 28px;
                  margin-bottom: 15px;
                  color: #e5308c;
                  text-shadow: 0 0 5px rgba(229, 48, 140, 0.5);
                }
                
                .error-message {
                  font-size: 18px;
                  margin-bottom: 30px;
                  opacity: 0.8;
                  line-height: 1.6;
                }
                
                .back-button {
                  display: inline-block;
                  padding: 10px 25px;
                  background: linear-gradient(45deg, #e5308c, #8c30e5);
                  color: white;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: bold;
                  transition: transform 0.3s, box-shadow 0.3s;
                  position: relative;
                  overflow: hidden;
                  box-shadow: 0 5px 15px rgba(229, 48, 140, 0.3);
                  margin-top: 20px;
                }
                
                .back-button:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 8px 20px rgba(229, 48, 140, 0.5);
                }
                
                .back-button:active {
                  transform: translateY(1px);
                }
                
                .video-id {
                  font-family: monospace;
                  background-color: rgba(255, 255, 255, 0.1);
                  padding: 5px 10px;
                  border-radius: 4px;
                  margin: 10px 0;
                  display: inline-block;
                }
                
                @keyframes server-shake {
                  0%, 100% { transform: rotateY(0deg) rotateZ(0deg); }
                  25% { transform: rotateY(1deg) rotateZ(0.5deg); }
                  75% { transform: rotateY(-1deg) rotateZ(-0.5deg); }
                }
                
                @keyframes blink {
                  0% { opacity: 0.3; }
                  100% { opacity: 1; }
                }
                
                @keyframes float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-15px); }
                }
                
                @keyframes cloud-move {
                  0%, 100% { transform: translateX(0); opacity: 0.5; }
                  50% { transform: translateX(-20px); opacity: 0.8; }
                }
                
                @keyframes lightning {
                  0%, 30%, 70%, 100% { opacity: 0; }
                  40%, 60% { opacity: 1; }
                }
                
                .logo {
                  font-size: 24px;
                  font-weight: bold;
                  margin-bottom: 20px;
                  color: #e5308c;
                  text-shadow: 0 0 10px rgba(229, 48, 140, 0.5);
                  letter-spacing: 1px;
                }
              </style>
            </head>
            <body>
              <div class="logo">WovIeX</div>
              <div class="error-container">
                <div class="server-animation">
                  <div class="cloud"></div>
                  <div class="lightning"></div>
                  <div class="server">
                    <div class="server-light"></div>
                    <div class="server-light"></div>
                    <div class="server-light"></div>
                    <div class="server-slots"></div>
                    <div class="server-slots"></div>
                    <div class="server-slots"></div>
                  </div>
                </div>
                <h1 class="error-title">Server Down</h1>
                <p class="error-message">Sorry, we couldn't get the video URL from the server. This could be due to server maintenance or high traffic.</p>
                <div class="video-id">Video ID: ${id}, Season: ${seasonid}, Episode: ${episodeid}</div>
                <p>Title: ${video.title || 'Unknown'}</p>
                <a href="javascript:history.back()" class="back-button">Go Back</a>
              </div>
            </body>
          </html>
        `);
      }
      
      console.log(`Successfully found video URL for ${id}`);

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
        // Read the simple player template file
        const templatePath = path.join(process.cwd(), 'player_template_simple.html');
        let playerTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Add season and episode to the title for this route
        const seasonEpisodeInfo = ` S${seasonid} E${episodeid}`;
        const titleWithSeasonEp = video.title ? `${video.title}${seasonEpisodeInfo}` : `Video Player${seasonEpisodeInfo}`;
        
        // Encrypt the video URL for secure playback
        const encryptedUrl = encryptVideoUrl(video.url);
        const streamUrl = `/stream/${encryptedUrl}`;
        
        // Prepare quality options for the player
        let qualityOptionsArray = [];
        let selectedQuality = { label: video.quality || 'HD' };
        
        if (video.qualityOptions && Array.isArray(video.qualityOptions)) {
          try {
            qualityOptionsArray = video.qualityOptions.map(opt => {
              if (typeof opt === 'string') {
                try {
                  return JSON.parse(opt);
                } catch (e) {
                  return { label: 'Unknown', url: opt };
                }
              }
              return opt;
            });
            
            // Encrypt all stream URLs
            qualityOptionsArray = qualityOptionsArray.map(opt => {
              if (opt && opt.url) {
                const encryptedQualityUrl = encryptVideoUrl(opt.url);
                return { 
                  ...opt, 
                  url: `/stream/${encryptedQualityUrl}` 
                };
              }
              return opt;
            });
            
            // Find the highest quality option to use as selected
            if (qualityOptionsArray.length > 0) {
              // Try to find HD or highest available quality
              const hdOption = qualityOptionsArray.find(opt => 
                opt.label && (opt.label.includes('HD') || opt.label.includes('720p') || opt.label.includes('1080p'))
              );
              
              if (hdOption) {
                selectedQuality = hdOption;
              } else {
                // Sort by numeric part of quality label (e.g., 480p -> 480)
                qualityOptionsArray.sort((a, b) => {
                  const aNum = parseInt((a.label || '').replace(/[^\d]/g, '')) || 0;
                  const bNum = parseInt((b.label || '').replace(/[^\d]/g, '')) || 0;
                  return bNum - aNum; // Sort descending
                });
                
                // Use the first (highest) quality
                selectedQuality = qualityOptionsArray[0];
              }
            }
          } catch (qErr) {
            console.error('Error processing quality options:', qErr);
          }
        }
        
        // Prepare subtitle options for the player
        let subtitleOptionsArray = [];
        
        if (video.subtitleOptions && Array.isArray(video.subtitleOptions)) {
          try {
            subtitleOptionsArray = video.subtitleOptions.map(opt => {
              if (typeof opt === 'string') {
                try {
                  return JSON.parse(opt);
                } catch (e) {
                  return { label: 'Unknown', url: opt, language: 'en' };
                }
              }
              return opt;
            });
          } catch (sErr) {
            console.error('Error processing subtitle options:', sErr);
          }
        }
        
        // Create a data object with all video properties
        const videoData = {
          url: streamUrl,
          title: titleWithSeasonEp,
          quality: video.quality || 'HD',
          selectedQuality: selectedQuality,
          qualityOptions: qualityOptionsArray,
          subtitleOptions: subtitleOptionsArray
        };
        
        // Replace all template variables using Function constructor
        // This approach is safer for complex template variables
        playerTemplate = playerTemplate.replace(/\$\{([^}]+)\}/g, (match, expr) => {
          try {
            // Create a safe evaluation context with only the video object
            const result = new Function('video', `return ${expr};`)(videoData);
            return result !== undefined ? result : '';
          } catch (e) {
            console.error(`Failed to evaluate template expression: ${expr}`, e);
            return '';
          }
        });
        
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
          <div class="video-title">${video.title || 'Video Player'}</div>
          <div class="wovie-logo">WovIeX</div>
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
      console.error(`Error in fulltaah endpoint for ${id}:`, error instanceof Error ? error.message : String(error));
      
      try {
        await storage.createLog({
          level: 'ERROR',
          source: 'API',
          message: `Error serving player for video ${id} with season ${seasonid}, episode ${episodeid}: ${error instanceof Error ? error.message : String(error)}`
        }).catch(err => console.error('Failed to log error:', err));
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      return res.status(500).send(`
        <html>
          <head>
            <title>Video Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; }
              .error-container { padding: 20px; border: 1px solid #f1f1f1; border-radius: 5px; }
              .error-title { color: #e74c3c; }
              .back-button { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1 class="error-title">Video Playback Error</h1>
              <p>Sorry, we couldn't play this video. Please try again later or choose another video.</p>
              <p>Error details: ${error instanceof Error ? error.message : 'Unknown error'}</p>
              <p>Video ID: ${id}, Season: ${seasonid}, Episode: ${episodeid}</p>
              <a href="javascript:history.back()" class="back-button">Go Back</a>
            </div>
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
  
  // Domain verification endpoint - check if a domain is whitelisted
  app.get('/api/domains/check', async (req, res) => {
    try {
      const { domain } = req.query;
      
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Domain parameter is required'
        });
      }
      
      const isWhitelisted = await storage.isDomainWhitelisted(domain);
      
      return res.json({
        success: true,
        data: {
          domain,
          whitelisted: isWhitelisted
        }
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
  app.get('/api/telegram/bot/info', authMiddleware, async (req, res) => {
    try {
      // Get bot username if available
      let username = 'your_bot';
      
      if (telegramBot.isActive() && telegramBot.getBot()) {
        try {
          const bot = telegramBot.getBot();
          if (bot) {
            const botInfo = await bot.telegram.getMe();
            username = botInfo.username || 'your_bot';
          }
        } catch (botError) {
          console.error('Error fetching bot info:', botError);
        }
      }
      
      return res.json({
        success: true,
        username: username
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
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
      // Check if the bot is already running to avoid conflict
      if (telegramBot.isActive()) {
        return res.json({ 
          success: true, 
          message: 'Telegram bot is already running' 
        });
      }
      
      // Use a timeout to avoid blocking the response
      const startBotPromise = telegramBot.start().catch(error => {
        console.error('Background bot start failed:', error);
        // Don't throw, just log the error
      });
      
      // Don't wait for the bot to fully start - which might take time
      // Just send a response that we're attempting to start it
      return res.json({ 
        success: true, 
        message: 'Telegram bot start initiated' 
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
  
  // Verify Telegram channel access
  app.post('/api/telegram/channel/verify', authMiddleware, async (req, res) => {
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
          error: 'Telegram bot must be running to verify channel access' 
        });
      }
      
      console.log('API: Verifying channel access for ID:', channelId);
      const result = await telegramBot.verifyChannelAccess(channelId);
      
      return res.json({ 
        success: true, 
        data: result
      });
    } catch (error) {
      console.error('Error verifying channel access:', error);
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

      // Enable channel storage with the provided ID
      console.log('API: Calling enableChannelStorage with channelId:', channelId);
      const success = await telegramBot.enableChannelStorage(channelId);
      
      if (!success) {
        console.error('API: Failed to enable channel storage for ID:', channelId);
        return res.status(500).json({
          success: false,
          error: 'Failed to enable channel storage - please check server logs for details'
        });
      }
      
      // Verify once more that the channel is enabled with the correct ID
      const isEnabled = telegramBot.isChannelStorageEnabled();
      const actualChannelId = telegramBot.getChannelId();
      
      console.log('API: Channel storage enabled status:', {
        isEnabled,
        channelId: actualChannelId,
        expectedChannelId: channelId
      });
      
      // Test save to channel to verify it's working properly
      try {
        console.log('API: Sending test message to channel...');
        const testResult = await telegramBot.saveToChannel('test', { 
          timestamp: new Date().toISOString(),
          message: 'Channel storage test from API'
        });
        
        if (!testResult) {
          console.error('API: Failed to send test message to channel');
          return res.status(500).json({
            success: false,
            error: 'Failed to send test message to channel - please check the channel ID and bot permissions'
          });
        }
        
        console.log('API: Test message sent successfully');
      } catch (err) {
        console.error('API: Error testing channel storage:', err);
      }
      
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
      console.error('Error enabling channel storage:', error);
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
  
  // Telegram webhook endpoint for VPS/cloud services like Koyeb
  app.post('/api/telegram-webhook', (req, res) => {
    try {
      console.log('Received Telegram webhook request', {
        hasBody: !!req.body,
        bodyType: typeof req.body,
        isObject: req.body && typeof req.body === 'object',
        hasUpdateId: req.body && req.body.update_id !== undefined
      });
      
      // Security check - Telegram webhook should come from Telegram servers
      // In a real production environment, you would also validate the request IP ranges
      // However, in a serverless environment like Koyeb, we might not have access to the original IP
      
      // Check if request has a valid Telegram update structure
      if (!req.body || typeof req.body !== 'object' || req.body.update_id === undefined) {
        console.warn('Invalid webhook request format, missing update_id');
        return res.status(200).json({ ok: true, message: 'Invalid update format' });
      }
      
      // If the bot is active, process the update
      if (telegramBot.isActive() && telegramBot.getBot()) {
        const bot = telegramBot.getBot()!;
        
        // Log details about the update for debugging
        const updateType = 
          req.body.message ? 'message' : 
          req.body.callback_query ? 'callback_query' : 
          req.body.inline_query ? 'inline_query' : 
          'unknown';
          
        console.log(`Processing webhook update ID ${req.body.update_id} of type ${updateType}`);
        
        // Use the Telegraf bot instance to handle the update
        bot.handleUpdate(req.body, res)
          .then(() => {
            // Success - response is already sent by handleUpdate
            console.log(`Successfully processed webhook update ${req.body.update_id}`);
          })
          .catch(err => {
            console.error('Error handling Telegram update:', err);
            // Always return 200 to Telegram servers to avoid repeated delivery attempts
            if (!res.headersSent) {
              res.status(200).json({ ok: true, message: 'Error processing update' });
            }
          });
      } else {
        console.log('Received webhook request but bot is not active, starting bot...');
        
        // Try to start the bot first
        telegramBot.start()
          .then(() => {
            if (telegramBot.isActive() && telegramBot.getBot()) {
              const bot = telegramBot.getBot()!;
              return bot.handleUpdate(req.body, res);
            } else {
              throw new Error('Bot is still not active after start attempt');
            }
          })
          .then(() => {
            console.log(`Successfully processed webhook after bot start: update ${req.body.update_id}`);
          })
          .catch(startError => {
            console.error('Failed to start bot or process webhook:', startError);
            if (!res.headersSent) {
              res.status(200).json({ ok: true, message: 'Bot could not be activated' });
            }
          });
      }
    } catch (error) {
      console.error('Unhandled error in Telegram webhook:', error);
      // Always return 200 to Telegram servers
      if (!res.headersSent) {
        res.status(200).json({ ok: true, message: 'Error processing webhook' });
      }
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
            (async () => {
              try {
                // Wait a moment for the bot to fully initialize before enabling channel storage
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('Attempting to enable channel storage from environment variable...');
                const success = await telegramBot.enableChannelStorage(process.env.TELEGRAM_CHANNEL_ID);
                
                if (success) {
                  console.log('Successfully enabled channel storage from environment variable');
                } else {
                  console.error('Failed to enable channel storage from environment variable');
                }
              } catch (error) {
                console.error('Error enabling channel storage from environment variable:', error);
              }
            })();
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
