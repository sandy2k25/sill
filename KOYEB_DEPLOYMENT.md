# Deploying Sill to Koyeb

This guide explains how to deploy Sill to Koyeb, addressing the specific error with Puppeteer.

## The Problem

You're seeing this error:
```
Error: Dynamic require of "puppeteer" is not supported
```

This happens because:
1. Puppeteer requires Chrome/Chromium which isn't available in Koyeb's default environment
2. ESM modules in production have issues with dynamic imports of Puppeteer

## Solution: Create a Custom Dockerfile

The best approach is to create a Dockerfile that includes all the necessary dependencies for Puppeteer.

### Step 1: Create a Dockerfile

Create a file named `Dockerfile` in your project root:

```bash
FROM node:18-bullseye-slim

WORKDIR /app

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the installed version of Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Build the project
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
```

### Step 2: Create a .dockerignore File

Create a `.dockerignore` file to exclude unnecessary files:

```
node_modules
npm-debug.log
dist
.git
.env
.env.*
```

### Step 3: Modify server/scraper.ts File

You need to adjust the scraper to work with the installed Chromium in your Docker image.

1. Open `server/scraper.ts`
2. Find the code that initializes Puppeteer
3. Replace it with a version that respects the environment variable:

```typescript
// Modify the initialize method in the WovIeX class
private async initialize() {
  if (this.browser) return;
  
  try {
    // Check for environment-specific configuration
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      // In Docker/Koyeb environment
      const puppeteer = await import('puppeteer');
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        headless: 'new'
      });
    } else {
      // In other environments
      const puppeteer = await import('puppeteer');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    
    logInfo('Scraper', 'Browser initialized successfully');
  } catch (error) {
    logError('Scraper', `Failed to initialize browser: ${error.message}`);
    // Use fallback if necessary
    await this.initializeFallback();
  }
}

// Add a fallback initialization if needed
private async initializeFallback() {
  logInfo('Scraper', 'Using HTTP fallback mode');
  // Your existing fallback code here
}
```

### Step 4: Deploy to Koyeb

1. Push your changes to your GitHub repository.

2. In Koyeb:
   - Create a new app
   - Select "Docker" as the runtime
   - Connect your GitHub repository
   - Set your main branch
   - Set the port to 8080 (the one we exposed in the Dockerfile)
   - Add your environment variables:
     * `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
     * `TELEGRAM_CHAT_ID` - Your Telegram channel ID
     * `JWT_SECRET` - Random string for authentication
     * `ADMIN_USERNAME` - Admin username
     * `ADMIN_PASSWORD` - Admin password

3. Deploy the app

## Alternative: Modify Your App to Not Use Puppeteer

If you don't want to use a Dockerfile, you can modify your app to use only the HTTP fallback method for scraping:

1. Open `server/scraper.ts`
2. Find the scrapeVideo method
3. Modify it to always use the fallback HTTP method instead of Puppeteer

```typescript
async scrapeVideo(videoId: string, season?: string | number, episode?: string | number): Promise<InsertVideo> {
  // Always use fallback without trying Puppeteer
  return await this.fallbackHTTPScrape(videoId);
}
```

This approach is simpler but may be less reliable if the fallback method doesn't work as well as Puppeteer.

## Troubleshooting

If you're still having issues:

1. Check Koyeb logs for specific errors
2. Make sure all required environment variables are set
3. Verify your Telegram bot is correctly set up
4. Try deploying with the alternative method if the Dockerfile approach doesn't work