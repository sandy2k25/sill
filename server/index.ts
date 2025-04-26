import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { videoScraper } from "./scraper";
import { telegramBot } from "./telegram";
import { initLogger } from "./logger";
import { generatePasswordHash } from "./auth";
import { db } from "./db";
import { users, domains } from "@shared/schema";

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

// Initialize the database with default values
async function initializeDatabase() {
  try {
    console.log('Initializing database with default values...');
    
    // Check if we have any users
    const existingUsers = await db.select().from(users);
    
    // If no users exist, create a default admin
    if (existingUsers.length === 0) {
      console.log('No users found, creating default admin user...');
      const adminPassword = process.env.WEB_ADMIN_PASSWORD || 'admin';
      const hashedPassword = await generatePasswordHash(adminPassword);
      
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword
      });
      
      console.log('Default admin user created');
    }
    
    // Check if we have any domains
    const existingDomains = await db.select().from(domains);
    
    // If no domains exist, add default allowed domains
    if (existingDomains.length === 0) {
      console.log('No domains found, adding default whitelisted domains...');
      
      const defaultDomains = [
        { domain: 'localhost', active: true },
        { domain: 'iframe.example.com', active: true },
        { domain: 'example.com', active: true }
      ];
      
      for (const domain of defaultDomains) {
        await db.insert(domains).values({
          domain: domain.domain,
          active: domain.active,
          addedAt: new Date()
        });
      }
      
      console.log('Default domains added');
    }
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

(async () => {
  // Initialize the database before starting the server
  await initializeDatabase();
  
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
