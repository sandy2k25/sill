# Deploying the Complete WovIeX Application to Netlify

This guide explains how to deploy the full WovIeX application to Netlify, including both frontend and backend functionality.

## Prerequisites

1. A Netlify account
2. A PostgreSQL database (preferably Neon for serverless compatibility)
3. Git repository with your WovIeX code

## Step 1: Prepare Your Environment Variables

Before deploying, you'll need to set up the following environment variables in Netlify's settings:

```
DATABASE_URL=postgres://username:password@your-db-host.com:5432/dbname
JWT_SECRET=your-jwt-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token (optional)
TELEGRAM_CHANNEL_ID=your-telegram-channel-id (optional)
TELEGRAM_ADMIN_IDS=1234567890 (optional)
```

## Step 2: Deploy to Netlify

You can deploy using any of these methods:

### Option A: Deploy from Git Repository

1. Log in to your Netlify account
2. Click "New site from Git"
3. Select your Git provider and repository
4. Configure the build settings:
   - Build command: `node netlify-full.js`
   - Publish directory: `dist/public`
5. Click "Deploy site"

### Option B: Deploy from Local Directory

1. Run the build script locally: `node netlify-full.js`
2. Install Netlify CLI: `npm install -g netlify-cli`
3. Log in to Netlify: `netlify login`
4. Deploy using CLI: `netlify deploy --prod --dir=dist`

## Step 3: Database Setup

This application uses Drizzle ORM. To set up your database:

1. Make sure your DATABASE_URL environment variable is set correctly
2. The database schema will be automatically applied on initial run

## Step 4: Testing Your Deployment

Once deployed, you can test your API with these endpoints:

- `/.netlify/functions/api/videos` - List videos
- `/.netlify/functions/api/domains` - List domains
- `/.netlify/functions/api/status` - Check API status

The frontend will automatically use these API endpoints when running on Netlify.

## Troubleshooting

### Common Issues

1. **CORS errors**: Make sure your Netlify Functions are properly configured to allow requests from your domain.

2. **Database connection issues**: Verify that your DATABASE_URL is correct and your database is accessible from Netlify Functions.

3. **Function timeouts**: If your functions are timing out, try increasing the timeout in netlify.toml.

### Logs and Debugging

You can view logs for your Netlify Functions in the Netlify dashboard:

1. Go to your site in the Netlify dashboard
2. Click "Functions"
3. Select a function to view its logs

## Additional Configuration

### Custom Domain

1. Go to your site settings in Netlify
2. Click "Domain settings"
3. Follow the instructions to add your custom domain

### Environment Variables

You can add or modify environment variables in your site settings:

1. Go to your site in the Netlify dashboard
2. Click "Site settings" > "Build & deploy" > "Environment"
3. Add your variables here