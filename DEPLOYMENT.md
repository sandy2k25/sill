# Deploying Sill on Render.com - Complete Guide

This guide provides comprehensive, step-by-step instructions for deploying the Sill video scraper application on Render.com.

## Table of Contents

1. [Why Render.com](#why-rendercom)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
   - [Web Service Setup](#1-web-service-setup)
   - [Critical Environment Variables](#2-critical-environment-variables)
   - [Authentication Credentials](#3-authentication-credentials)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Accessing Your Application](#accessing-your-application)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)
7. [Render-Specific Features](#render-specific-features)
8. [Maintenance and Updates](#maintenance-and-updates)

## Why Render.com

Render.com is ideal for deploying Sill because it:
- Automatically handles SSL certificates
- Offers free tier for testing
- Enables one-click deployment from GitHub
- Provides environment variable management for secure credentials
- Requires minimal DevOps knowledge

## Prerequisites

Before starting, make sure you have:

1. A [Render.com account](https://render.com/signup)
2. Access to the [Sill GitHub repository](https://github.com/sandy2k25/sill)
3. Your Telegram bot token (required for Telegram integration)
4. Your Telegram channel ID (required for Telegram storage)
5. Admin and bot passwords for your installation

## Deployment Steps

### 1. Web Service Setup

Deploy the Sill application as a web service:

1. Log in to your [Render Dashboard](https://dashboard.render.com/)
2. Click on **New** > **Web Service**
3. Connect your GitHub repository or use **Deploy from GitHub** option
   - Find and select the Sill repository
   
   ![Connect Repository](https://i.imgur.com/example1.png)
   
4. Fill in the service details:
   - **Name**: `sill` (or your preferred name)
   - **Region**: Select the region closest to your users
   - **Branch**: `main` (or your preferred branch)
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   
   ![Service Configuration](https://i.imgur.com/example2.png)
   
5. Scroll down to **Advanced** settings and click to expand

### 2. Critical Environment Variables

Configure the necessary environment variables:

1. In the **Environment Variables** section, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render's default port)
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (required for bot functionality)
   - `TELEGRAM_CHANNEL_ID`: Your Telegram channel ID (required for persistent storage)
   - `TELEGRAM_BOT_ADMIN_PASSWORD`: Password for Telegram bot admin access
   - `ADMIN_PASSWORD`: Password for web admin interface (overrides default)
   
   ![Environment Variables](https://i.imgur.com/example3.png)
   
2. Under **Health Check Path**: Enter `/api/stats` (if your app has this route) or `/`
3. Click **Create Web Service**

Your application will now start deploying. This process typically takes 5-10 minutes for the first deployment.

### 3. Authentication Credentials

Understanding the different authentication methods:

1. **Web Admin Interface**:
   - Default username: `admin`
   - Default password: `admin123` (override with `ADMIN_PASSWORD` environment variable)
   - Access URL: `https://your-service-name.onrender.com/nimda`

2. **Telegram Bot Admin**:
   - Set with `TELEGRAM_BOT_ADMIN_PASSWORD` environment variable
   - Used when interacting with the Telegram bot
   - To authenticate, message the bot with: `/admin your_password`
   - Required for administrative commands to the bot

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
   - Telegram token issues: Verify your TELEGRAM_BOT_TOKEN is correct
   - Build errors: Check if the build command is completing successfully
   - Memory issues: Consider upgrading to a higher tier if you're on the free plan

### Telegram Bot Issues

If your Telegram bot isn't functioning properly:

1. Verify that your TELEGRAM_BOT_TOKEN is correct and valid
2. Check if your TELEGRAM_CHANNEL_ID is in the correct format
3. Ensure the bot has been added to the channel with admin permissions
4. Check application logs for any Telegram-related error messages

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

### Telegram Channel as Backup

The Sill application uses a Telegram channel for data storage and backup.

To ensure your data is backed up:

1. Verify that your TELEGRAM_CHANNEL_ID is correctly configured
2. Make sure the bot has admin permissions in the channel
3. Check the admin dashboard to confirm Telegram storage is working properly

The application will automatically save important information to this channel for persistence.

## One-Click Deployment

For future deployments, you can use the one-click deploy button in your GitHub repository's README:

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sandy2k25/sill)
```

## Cost Optimization

- Free tier services on Render sleep after 15 minutes of inactivity
- For production use, consider the $7/month Starter plan which stays active 24/7
- Total cost for a basic production deployment: ~$7/month for the starter plan
- No database costs as the application uses Telegram for data storage