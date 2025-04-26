import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { videoScraper } from "./scraper";
import { telegramBot } from "./telegram";
import { initLogger } from "./logger";
import { generatePasswordHash } from "./auth";

// Set Replit environment flag for use in conditional code paths
process.env.REPLIT_ENVIRONMENT = "true";

// Initialize the logger with storage for logging
initLogger(storage);

// Initialize the scraper with storage for database access
videoScraper.setStorage(storage);

// Initialize Telegram bot with storage and scraper
telegramBot.setStorage(storage);
telegramBot.setVideoScraper(videoScraper);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize Telegram storage
async function initializeTelegramStorage() {
  try {
    console.log('Initializing Telegram storage...');
    
    // Check if Telegram bot token is available
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('WARNING: TELEGRAM_BOT_TOKEN environment variable not set. Telegram bot will not be available.');
    } else {
      console.log('Telegram bot token is available, starting bot...');
      
      // Start the Telegram bot
      await telegramBot.start();
      
      // Check if channel ID is available
      if (process.env.TELEGRAM_CHANNEL_ID) {
        console.log('Attempting to enable channel storage from environment variable...');
        const success = await telegramBot.enableChannelStorage();
        
        if (success) {
          console.log('Successfully enabled channel storage from environment variable');
        } else {
          console.error('Failed to enable channel storage from environment variable');
        }
      } else {
        console.warn('No TELEGRAM_CHANNEL_ID set, storage will not be persisted to Telegram');
      }
    }
    
    console.log('Telegram storage initialization complete');
  } catch (error) {
    console.error('Failed to initialize Telegram storage:', error);
  }
}

(async () => {
  // Start the server regardless of Telegram initialization
  // We'll initialize Telegram in the background
  setTimeout(async () => {
    try {
      console.log("Starting Telegram initialization in the background");
      await initializeTelegramStorage();
      console.log("Telegram initialization completed in the background");
    } catch (error) {
      console.error("Failed to initialize Telegram storage in the background:", error);
    }
  }, 5000); // Wait 5 seconds after server start before initializing Telegram
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
