# Deploying Sill on Render.com - Complete Guide

This guide provides comprehensive, step-by-step instructions for deploying the Sill video scraper application on Render.com.

## Table of Contents

1. [Why Render.com](#why-rendercom)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
   - [Database Setup](#1-database-setup)
   - [Web Service Setup](#2-web-service-setup)
   - [Environment Variables](#3-environment-variables)
   - [Database Initialization](#4-database-initialization)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Accessing Your Application](#accessing-your-application)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)
7. [Render-Specific Features](#render-specific-features)
8. [Maintenance and Updates](#maintenance-and-updates)

## Why Render.com

Render.com is ideal for deploying Sill because it:
- Automatically handles SSL certificates
- Provides managed PostgreSQL databases
- Offers free tier for testing
- Enables one-click deployment from GitHub
- Requires minimal DevOps knowledge

## Prerequisites

Before starting, make sure you have:

1. A [Render.com account](https://render.com/signup)
2. Access to the [Sill GitHub repository](https://github.com/sandy2k25/sill)
3. (Optional) A Telegram bot token if you plan to use Telegram features

## Deployment Steps

### 1. Database Setup

First, create a PostgreSQL database for your Sill application:

1. Log in to your [Render Dashboard](https://dashboard.render.com/)
2. Click on **New** in the top right corner
3. Select **PostgreSQL** from the dropdown menu
4. Fill in the database details:
   - **Name**: `sill-db` (or your preferred name)
   - **Database**: `silldb`
   - **User**: Leave default
   - **Region**: Choose the closest to your users
   - **PostgreSQL Version**: 14 or higher
   - **Instance Type**: Free (for testing) or higher for production
   
   ![Database Setup](https://i.imgur.com/example1.png)
   
5. Click **Create Database**
6. After creation, you'll see the database information screen. **Important**: Note the **Internal Database URL** for the next step.

### 2. Web Service Setup

Now, deploy the Sill application as a web service:

1. Return to the Render Dashboard
2. Click on **New** > **Web Service**
3. Connect your GitHub repository or use **Deploy from GitHub** option
   - Find and select the Sill repository
   
   ![Connect Repository](https://i.imgur.com/example2.png)
   
4. Fill in the service details:
   - **Name**: `sill` (or your preferred name)
   - **Region**: Select the same region as your database
   - **Branch**: `main` (or your preferred branch)
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   
   ![Service Configuration](https://i.imgur.com/example3.png)
   
5. Scroll down to **Advanced** settings and click to expand

### 3. Environment Variables

Configure the necessary environment variables:

1. In the **Environment Variables** section, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render's default port)
   - `DATABASE_URL`: [Paste the Internal Database URL from step 1]
   - `TELEGRAM_BOT_TOKEN`: [Your Telegram bot token if available]
   - `TELEGRAM_CHANNEL_ID`: [Your Telegram channel ID if available]
   
   ![Environment Variables](https://i.imgur.com/example4.png)
   
2. Under **Health Check Path**: Enter `/api/stats` (if your app has this route) or `/`
3. Click **Create Web Service**

Your application will now start deploying. This process typically takes 5-10 minutes for the first deployment.

### 4. Database Initialization

After the web service is successfully deployed, initialize the database:

1. From your web service dashboard, go to the **Shell** tab
2. Run the database migration command:
   ```bash
   npx drizzle-kit push
   ```
3. Wait for the command to complete successfully

## Post-Deployment Configuration

### Setting Up Admin Access

1. Access your application at the URL provided by Render (e.g., `https://sill.onrender.com/nimda`)
2. Log in with the default credentials:
   - Username: `admin`
   - Password: `admin123`
3. Immediately change the default password through the admin interface

### Configuring Telegram Bot (Optional)

If you're using the Telegram integration:

1. Ensure you've added the `TELEGRAM_BOT_TOKEN` environment variable
2. Access your admin dashboard
3. Navigate to the Telegram configuration section
4. Follow the on-screen instructions to connect your bot

## Accessing Your Application

Your Sill application is now accessible at:
- Main URL: `https://your-service-name.onrender.com`
- Admin area: `https://your-service-name.onrender.com/nimda`

## Troubleshooting Common Issues

### Application Not Starting

If your application fails to start:

1. Check the **Logs** tab in your Render web service dashboard
2. Common issues include:
   - Database connection errors: Verify your DATABASE_URL is correct
   - Build errors: Check if the build command is completing successfully
   - Memory issues: Consider upgrading to a higher tier if you're on the free plan

### Database Connection Issues

If your application cannot connect to the database:

1. Verify that you're using the **Internal Database URL** (not the external one)
2. Check if the database is running in the Render dashboard
3. Try connecting to the database manually using the Shell:
   ```bash
   psql $DATABASE_URL
   ```

### Environment Variable Problems

If environment variables aren't being recognized:

1. Double-check all variable names and values in the Render dashboard
2. Remember that changes to environment variables require a service restart
3. Click **Manual Deploy** > **Clear build cache & deploy** to ensure changes take effect

## Render-Specific Features

### Custom Domains

To use your own domain:

1. Go to your web service in the Render dashboard
2. Click on the **Settings** tab
3. Scroll down to **Custom Domain**
4. Click **Add Custom Domain**
5. Follow the on-screen instructions to configure DNS settings

### Auto-Scaling (Paid Plans)

For production deployments with higher traffic:

1. Upgrade to a paid plan
2. Go to your web service settings
3. Under **Scaling** configure:
   - Auto-scaling limits
   - Instance count

### Background Workers

If your application needs background processing:

1. Consider creating a separate Background Worker service in Render
2. Configure it with the same environment variables
3. Use a different start command for your worker process

## Maintenance and Updates

### Updating Your Application

When you push changes to your GitHub repository:

1. Render will automatically detect the changes
2. A new build will be triggered
3. Once successful, your application will be updated

For manual updates:

1. Go to your web service dashboard
2. Click **Manual Deploy** > **Deploy latest commit**

### Database Backups

Render automatically takes daily backups of your PostgreSQL database.

To create a manual backup:

1. Go to your PostgreSQL service in the Render dashboard
2. Click the **Backups** tab
3. Click **Manual Backup**

To restore from a backup:

1. Go to the **Backups** tab
2. Find the backup you want to restore
3. Click the three dots menu > **Restore**

## One-Click Deployment

For future deployments, you can use the one-click deploy button in your GitHub repository's README:

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sandy2k25/sill)
```

## Cost Optimization

- Free tier services on Render sleep after 15 minutes of inactivity
- For production use, consider the $7/month Starter plan which stays active 24/7
- Database costs start at $7/month for the Starter tier
- Total cost for a basic production deployment: ~$14/month