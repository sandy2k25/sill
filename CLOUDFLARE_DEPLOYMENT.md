# Complete Guide to Deploying WovIeX on Cloudflare

This guide explains how to deploy the WovIeX application to Cloudflare from scratch, including creating all necessary secrets and configurations.

## Prerequisites

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
2. Install Node.js and npm on your computer
3. Your WovIeX codebase

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
name = "woviex-api"
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
```

When you run each command, you'll be prompted to enter the value for each secret.

## Step 3: Database Setup

Cloudflare offers several database options:

### Option 1: Cloudflare D1 (SQLite-compatible database)

```bash
# Create a D1 database
wrangler d1 create woviex-db

# This will output a database_id - add it to your wrangler.toml:
```

Add this to your wrangler.toml:
```toml
[[d1_databases]]
binding = "DB"
database_name = "woviex-db"
database_id = "YOUR_DATABASE_ID" # Use the ID from the command output
```

### Option 2: External PostgreSQL Database (Neon)

1. Sign up for a free [Neon PostgreSQL database](https://neon.tech)
2. Create a new project and get your connection string
3. Add the connection string as a secret:

```bash
wrangler secret put DATABASE_URL
```

## Step 4: Deploy Your Backend Worker

```bash
# First test locally
wrangler dev

# Then publish to Cloudflare
wrangler publish
```

This will deploy your API to a URL like `https://woviex-api.username.workers.dev`

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
     - Add `API_URL` set to your Worker URL (e.g., `https://woviex-api.username.workers.dev/api`)

## Step
6: Configure Your Frontend

Create a file `client/src/api-config.js` to connect to your Worker:

```javascript
// Get the API URL from environment or use a default for local development
export const API_BASE_URL = 
  window.ENV && window.ENV.API_URL 
    ? window.ENV.API_URL 
    : 'https://woviex-api.username.workers.dev/api';

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

1. Visit your Cloudflare Pages URL (e.g., `https://woviex.pages.dev`)
2. Test API endpoints (e.g., `https://woviex-api.username.workers.dev/api/status`)
3. Make sure the frontend can communicate with the backend

## Handling API Routes

Your Worker (in `worker/index.js`) needs to handle all the API routes that your Express server currently handles. The template file already includes handlers for:

- Authentication (`/api/auth/login`)
- Videos list (`/api/videos`)
- Domains list (`/api/domains`) 
- Status check (`/api/status`)

You'll need to expand this file to handle all the routes your application needs.

## Migrating Your Data

If you have existing data, you'll need to migrate it to your Cloudflare database:

1. Export your data from your current database
2. Transform it to the format required by your Cloudflare database
3. Import it using appropriate methods (D1, KV, or external database tools)

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