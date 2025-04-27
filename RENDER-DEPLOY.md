# Deploy Sill to Render.com

This document provides instructions for deploying the Sill project to Render.com, either manually or using the one-click deploy button.

## Quick Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sandy2k25/sill)

The deploy button will:
1. Create a web service running the Sill application
2. Set up a PostgreSQL database
3. Link them together with the proper environment variables

## Post-Deployment Steps

After deployment completes, you'll need to:

1. **Initialize the database**:
   * Go to your web service in the Render dashboard
   * Click on the **Shell** tab
   * Run: `npx drizzle-kit push`

2. **Access the admin area**:
   * Go to `https://your-service-name.onrender.com/nimda`
   * Login with default credentials:
     * Username: `admin`
     * Password: `admin123`
   * **IMPORTANT**: Change the default password immediately!

3. **Configure Telegram** (optional):
   * In your web service settings, add:
     * `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
     * `TELEGRAM_CHANNEL_ID`: Your Telegram channel ID

## Manual Deployment

If you prefer to deploy manually:

1. **Create a PostgreSQL database**:
   * In Render dashboard, go to **PostgreSQL**
   * Click **New PostgreSQL**
   * Configure your database and create it
   * Note the Internal Database URL

2. **Create a web service**:
   * Go to **Web Services** → **New Web Service**
   * Connect to the GitHub repository: https://github.com/sandy2k25/sill
   * Configure with:
     * Build Command: `npm install && npm run build`
     * Start Command: `node dist/index.js`
     * Environment Variables:
       * `NODE_ENV`: `production`
       * `PORT`: `10000`
       * `DATABASE_URL`: Your Internal Database URL

3. **Initialize the database** (as in Post-Deployment Steps above)

## Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| NODE_ENV | Set to "production" for deployment | Yes |
| PORT | The port Render will use (10000) | Yes |
| DATABASE_URL | PostgreSQL connection string | Yes |
| TELEGRAM_BOT_TOKEN | For Telegram bot functionality | No |
| TELEGRAM_CHANNEL_ID | For Telegram storage backup | No |

### Custom Domain

To use a custom domain:
1. Go to your web service in Render
2. Click **Settings** tab
3. Scroll to **Custom Domain**
4. Click **Add Custom Domain**
5. Follow the instructions to configure DNS

## Troubleshooting

### Application Not Starting

Check logs in the Render dashboard for error messages. Common issues:
* Database connection problems: Verify DATABASE_URL
* Build failures: Check if all dependencies are in package.json

### Database Migration Issues

If database initialization fails:
1. Check if the database exists and is accessible
2. Try running migrations manually in the Shell:
   ```
   cd /opt/render/project/src
   npx drizzle-kit push
   ```

### Performance Issues

* Free tier services on Render sleep after 15 minutes of inactivity
* For production use, consider upgrading to a paid plan

## Scaling and Maintenance

### Scaling Up

If you need more resources:
1. Go to your web service in Render
2. Click **Settings** tab
3. Scroll to **Instance Type**
4. Select a higher tier

### Updating the Application

When you push changes to your GitHub repository, Render will automatically rebuild and deploy your app (if Auto-Deploy is enabled).

### Database Backups

Render automatically backs up your PostgreSQL database daily. To create manual backups:
1. Go to your database in Render
2. Click **Backups** tab
3. Click **Manual Backup**