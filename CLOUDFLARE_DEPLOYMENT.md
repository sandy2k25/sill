# Complete Guide to Deploying Sill on Cloudflare

This guide explains how to deploy the Sill application to Cloudflare from scratch, including configuring Telegram storage and all necessary security settings.

## Prerequisites

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
2. Have your Telegram bot token ready (or create a new bot using BotFather)
3. Your Sill codebase

## Step 1: Set Up Your Cloudflare Project

### Install Wrangler CLI

Wrangler is Cloudflare's command-line tool for managing Workers projects.

```bash
npm install -g wrangler
```

### Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

### Generate a JWT Secret

You don't need to have a JWT secret beforehand. Let's create one:

```bash
# Using Node.js to generate a random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output a random string that you can use as your JWT_SECRET.

## Step 2: Configure Your Backend API

### Update wrangler.toml

Update the `wrangler.toml` file (already in your project):

```toml
# Basic Worker configuration
name = "sill-api"
main = "worker/index.js"
compatibility_date = "2023-05-18"

# Create secure secrets using wrangler (you'll input these next)
# DO NOT put actual secrets in this file

# Development settings
[env.development]
workers_dev = true
```

### Set Secrets Using Wrangler

Instead of hardcoding secrets in the config file, use Wrangler to set them securely:

```bash
# Replace with the JWT secret you generated
wrangler secret put JWT_SECRET

# Set admin credentials
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD

# Set Telegram bot token and chat ID for storage
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

When you run each command, you'll be prompted to enter the value for each secret.

## Step 3: Telegram Storage Setup

The Sill application uses Telegram as its storage mechanism instead of a traditional database. This is how to set it up for Cloudflare:

### Create a Telegram Bot (if you don't have one)

1. Open Telegram and search for "BotFather"
2. Send the command `/newbot` and follow the instructions
3. BotFather will give you a token - this is your `TELEGRAM_BOT_TOKEN`

### Create a Telegram Channel for Storage

1. Create a new channel in Telegram
2. Add your bot as an administrator with posting privileges
3. Get the channel ID (you can use a bot like @username_to_id_bot)
4. This is your `TELEGRAM_CHAT_ID` (should be in format -100xxxxxxxxx)

### Configure the Worker for Telegram Storage

The worker code needs to be modified to use Telegram for storage:

1. Add Telegram API integration to worker/index.js
2. Ensure all storage operations are sent to Telegram
3. Set up periodic syncing to avoid data loss

## Step 4: Deploy Your Backend Worker

```bash
# First test locally
wrangler dev

# Then publish to Cloudflare
wrangler publish
```

This will deploy your API to a URL like `https://sill-api.username.workers.dev`

## Step 5: Deploy Your Frontend to Cloudflare Pages

1. Push your code to GitHub (if not already done)
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Pages
3. Click "Create a project"
4. Choose "Connect to Git" and select your repository
5. Configure the build settings:
   - Build command: `cd client && npm run build`
   - Build output directory: `client/dist`
   - Root directory: `/` (root of your repository)
   - Environment variables:
     - Add `API_URL` set to your Worker URL (e.g., `https://sill-api.username.workers.dev/api`)

## Step 6: Configure Your Frontend

Create a file `client/src/api-config.js` to connect to your Worker:

```javascript
// Get the API URL from environment or use a default for local development
export const API_BASE_URL = 
  window.ENV && window.ENV.API_URL 
    ? window.ENV.API_URL 
    : 'https://sill-api.username.workers.dev/api';

export async function fetchApi(endpoint, options = {}) {
  const url = endpoint.startsWith('/')
    ? `${API_BASE_URL}${endpoint}`
    : `${API_BASE_URL}/${endpoint}`;
    
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = new Error(`API request failed with status ${response.status}`);
    try {
      error.data = await response.json();
    } catch (e) {
      error.data = null;
    }
    throw error;
  }
  
  return response.json();
}
```

Then import and use this in your components instead of direct fetch calls.

## Step 7: Test Your Deployment

1. Visit your Cloudflare Pages URL (e.g., `https://sill.pages.dev`)
2. Test API endpoints (e.g., `https://sill-api.username.workers.dev/api/status`)
3. Make sure the frontend can communicate with the backend

## Handling API Routes

Your Worker (in `worker/index.js`) needs to handle all the API routes that your Express server currently handles. The template file already includes handlers for:

- Authentication (`/api/auth/login`)
- Videos list (`/api/videos`)
- Domains list (`/api/domains`) 
- Status check (`/api/status`)

You'll need to expand this file to handle all the routes your application needs.

## Migrating Your Data

If you have existing data in your Telegram storage:

1. It will automatically be accessible when you configure the Worker with the same Telegram bot and channel
2. No additional migration is needed since Telegram is already your storage mechanism
3. Just make sure the Worker's Telegram integration works correctly

## Important Considerations for Telegram Storage

1. **Rate Limits**: Telegram has API rate limits, so avoid making too many requests in a short time
2. **Message Size**: Telegram has message size limits (4096 characters), so chunk larger data
3. **Encryption**: Consider encrypting sensitive data before storing in Telegram
4. **Backup**: Periodically back up the Telegram chat content as an additional safety measure

## Custom Domain Setup

To use a custom domain:

1. Go to Cloudflare Dashboard > Pages > Your project
2. Click "Custom domains" > "Set up a custom domain"
3. Follow the instructions to add your domain

## Getting Help

If you encounter issues:
- Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Cloudflare has a helpful [community forum](https://community.cloudflare.com/)
- Review error logs in the Cloudflare Dashboard