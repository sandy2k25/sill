# Deployment Guide for WovIeX Application

This guide provides instructions for deploying the WovIeX application on Koyeb, VPS servers, Cloudflare, or other hosting platforms.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Koyeb Deployment](#koyeb-deployment)
3. [VPS Deployment](#vps-deployment)
4. [Cloudflare Deployment](#cloudflare-deployment)
5. [Telegram Bot Configuration](#telegram-bot-configuration)
6. [Channel Storage Configuration](#channel-storage-configuration)
7. [Webhook Mode vs Polling Mode](#webhook-mode-vs-polling-mode)
8. [Troubleshooting](#troubleshooting)

## Environment Variables

The application requires the following environment variables:

### Required Variables
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (from BotFather)
- `TELEGRAM_CHANNEL_ID`: The ID of your Telegram channel for storage
- `ADMIN_PASSWORD`: Password for the web admin interface (can also be set as `WEB_ADMIN_PASSWORD`)

### Optional Variables for Cloud/VPS Deployment
- `USE_WEBHOOK`: Set to "true" to force webhook mode (recommended for servers)
- `PUBLIC_URL` or `APP_URL`: The public URL of your application (e.g., https://yourdomain.com)
- `WEBHOOK_URL`: Alternative to PUBLIC_URL, full URL where Telegram should send webhooks
- `CLOUD_ENV` or `VPS`: Set to "true" to indicate a cloud/VPS environment

### Optional Admin Variables
- `TELEGRAM_ADMIN_USERS`: Comma-separated list of Telegram user IDs who are admins
- `BOT_ADMIN_PASSWORD`: Password for Telegram bot admin commands
- `API_KEY`: For direct API access (optional)

## Koyeb Deployment

1. **Create a Koyeb account** at [koyeb.com](https://koyeb.com) if you don't have one

2. **Deploy your app**:
   - Connect your GitHub repository or use Docker deployment
   - For GitHub deployment, select the repository and branch
   - Set the build command: `npm install`
   - Set the start command: `npm start`

3. **Configure Environment Variables**:
   - Add all the required environment variables listed above
   - Add `USE_WEBHOOK=true`
   - Add `PUBLIC_URL=https://your-koyeb-app-url.koyeb.app` (replace with your actual Koyeb URL)

4. **Deploy and Verify**:
   - Deploy the application
   - Check the logs to verify the application has started correctly
   - Verify that the Telegram bot webhook is properly configured

## VPS Deployment

1. **Prepare your VPS**:
   - Setup a fresh Ubuntu/Debian server
   - Install Node.js (v18+) and npm
   - Install git

2. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/woviex.git
   cd woviex
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHANNEL_ID=your_channel_id
   ADMIN_PASSWORD=your_admin_password
   BOT_ADMIN_PASSWORD=your_bot_admin_password
   USE_WEBHOOK=true
   PUBLIC_URL=https://your-domain.com
   ```

5. **Set up a reverse proxy (Nginx)**:
   ```
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Set up SSL with Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

7. **Start the application**:
   ```bash
   # Install PM2 for process management
   npm install -g pm2
   
   # Start the application
   pm2 start npm --name "woviex" -- start
   
   # Ensure it starts on boot
   pm2 startup
   pm2 save
   ```

## Cloudflare Deployment

### Option 1: Cloudflare Pages

1. **Prepare your project**:
   - Make sure your project is in a GitHub repository
   - Add a `_redirects` file to the root of your project:
   ```
   /* /index.html 200
   ```

2. **Configure your project in Cloudflare Pages**:
   - Log in to your Cloudflare dashboard
   - Go to Pages > Create a project
   - Connect your GitHub repository
   - Configure the build settings:
     - Framework preset: Custom
     - Build command: `npm install && npm run build`
     - Build output directory: `dist`
   - Add the required environment variables
   - Click "Save and Deploy"

3. **Configure Cloudflare Workers for API Functions**:
   Since Cloudflare Pages doesn't natively support Node.js APIs, you'll need to implement Cloudflare Workers:
   - Create a `functions` directory in your project
   - Create a catch-all API handler in `functions/api/[[path]].js`
   ```js
   export async function onRequest(context) {
     // Forward the request to your backend API
     const { request } = context;
     const url = new URL(request.url);
     
     // Replace with your actual backend API URL (like Koyeb or VPS)
     const apiUrl = "https://your-backend-api.com" + url.pathname + url.search;
     
     return fetch(apiUrl, {
       method: request.method,
       headers: request.headers,
       body: request.body
     });
   }
   ```

### Option 2: Cloudflare Workers

For a fully serverless deployment using Cloudflare Workers:

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Initialize Wrangler**:
   ```bash
   wrangler init
   ```

3. **Configure your wrangler.toml**:
   ```toml
   name = "woviex"
   type = "javascript"
   
   account_id = "your_account_id"
   workers_dev = true
   
   [env.production]
   routes = [
     "your-domain.com/*"
   ]
   
   [site]
   bucket = "./dist"
   entry-point = "workers-site"
   ```

4. **Configure environment variables**:
   ```bash
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHANNEL_ID
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put BOT_ADMIN_PASSWORD
   ```

5. **Build and deploy**:
   ```bash
   npm run build
   wrangler publish
   ```

### Option 3: Cloudflare for SPA and separate Backend

For the best performance, you can deploy the frontend on Cloudflare Pages and the backend on a VPS or Koyeb:

1. **Separate your project**:
   - Deploy the frontend (React app) to Cloudflare Pages
   - Deploy the backend (Express API) to Koyeb or a VPS

2. **Configure CORS**:
   - Add CORS headers to your backend API to allow requests from your Cloudflare Pages domain
   - Update your frontend API calls to point to your backend URL

3. **Use Cloudflare Proxy**:
   - Proxy your backend API through Cloudflare for added security and performance
   - Configure appropriate caching rules in Cloudflare dashboard

## Telegram Bot Configuration

1. **Create a bot with BotFather**:
   - Open Telegram and search for @BotFather
   - Send `/newbot` and follow the instructions
   - Copy the API token for your `.env` file

2. **Set up bot commands**:
   - Send `/setcommands` to @BotFather
   - Select your bot
   - Paste the following:
   ```
   help - Show help information
   stats - Show system statistics
   domain - Manage domain whitelist
   settings - Configure scraper settings
   cache - Manage video cache
   logs - View recent system logs
   channel - Manage storage channel
   admin - Authenticate as admin
   ```

## Channel Storage Configuration

1. **Create a Telegram channel**:
   - Create a new channel in Telegram
   - Add your bot as an administrator with posting privileges
   - Make the channel private

2. **Get the channel ID**:
   - Forward a message from the channel to @userinfobot
   - The bot will reply with the channel ID (should start with -100...)

3. **Set the channel ID in your environment variables**:
   - `TELEGRAM_CHANNEL_ID=your_channel_id`

## Webhook Mode vs Polling Mode

- **Webhook Mode (Recommended for production)**:
  - More efficient, no constant polling
  - Requires a public HTTPS URL
  - Set `USE_WEBHOOK=true` and provide `PUBLIC_URL`

- **Polling Mode (Default for development)**:
  - Works without a public URL
  - Less efficient for production use
  - Automatically used if webhook configuration is not available

## Troubleshooting

### Bot Not Responding
1. Check the logs to see if the bot started successfully
2. Verify your `TELEGRAM_BOT_TOKEN` is correct
3. If using webhook mode, ensure your domain is properly configured with HTTPS
4. Try restarting the application

### Channel Storage Issues
1. Verify the bot is an administrator in the channel
2. Ensure the channel ID is correctly formatted (should start with -100)
3. Check the application logs for errors related to channel access

### Webhook Setup Problems
1. Ensure your domain has a valid SSL certificate
2. Verify the webhook URL is accessible from the internet
3. Check Telegram's webhook info via:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Domain Authentication is Disabled
As requested, domain authentication has been disabled in this version. All domains are allowed to access and embed the player without restrictions. If you want to re-enable domain authentication in the future, you'll need to modify the `embedProtectionMiddleware` function in `server/utils.ts`.

---

For additional support or questions, please open an issue in the GitHub repository.