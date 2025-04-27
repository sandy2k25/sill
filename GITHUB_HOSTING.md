# WovIeX - GitHub Hosting Guide

This guide provides instructions for hosting and deploying the WovIeX application using GitHub. WovIeX is a sophisticated web scraping application for extracting video URLs with admin and user interfaces, Telegram bot integration, and enhanced video playback capabilities.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Repository Setup](#repository-setup)
4. [Environment Configuration](#environment-configuration)
5. [Local Development](#local-development)
6. [Deployment Options](#deployment-options)
7. [Telegram Bot Integration](#telegram-bot-integration)
8. [Troubleshooting](#troubleshooting)

## Project Overview

WovIeX is a full-stack TypeScript application that provides:

- Video URL extraction and embedding
- Web-based admin interface
- Telegram bot for remote management
- Domain whitelisting system
- Video cache management
- Plyr.io integration for enhanced video playback

## Prerequisites

Before setting up the project, ensure you have:

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (v8 or later)
- [Git](https://git-scm.com/)
- A [Telegram Bot](https://core.telegram.org/bots#creating-a-new-bot) (for admin functions)
- A Telegram channel (for optional storage)

## Repository Setup

1. **Create a GitHub repository**

   Create a new repository on GitHub through the web interface.

2. **Clone this project and push to your repository**

   ```bash
   # Clone your newly created repository
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   
   # Copy all project files to this directory
   # Then add, commit and push
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Repository Structure**

   The key files and directories are:
   
   - `/client`: Frontend code
   - `/server`: Backend API and services
   - `/shared`: Shared types and schemas
   - `package.json`: Dependencies and scripts

## Environment Configuration

The application requires several environment variables to function properly. Create a `.env` file in the root directory with these variables:

```
# Required environment variables
NODE_ENV=development
PORT=5000

# Admin authentication 
ADMIN_PASSWORD=your_admin_password_here

# Telegram Bot configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHANNEL_ID=your_telegram_channel_id_here
TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_bot_admin_password_here

# Optional: Database configuration (if using PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Obtaining the Required Secrets

1. **TELEGRAM_BOT_TOKEN**: 
   - Create a new bot using [BotFather](https://t.me/botfather) on Telegram
   - Use the `/newbot` command and follow the instructions
   - BotFather will provide a token like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`

2. **TELEGRAM_CHANNEL_ID**:
   - Create a new channel in Telegram
   - Add your bot as an administrator with posting privileges
   - Forward a message from this channel to [@userinfobot](https://t.me/userinfobot)
   - The bot will reply with the channel ID (should look like `-1001234567890`)

3. **ADMIN_PASSWORD** and **TELEGRAM_BOT_ADMIN_PASSWORD**:
   - Create secure passwords for web admin access and Telegram bot admin commands

## Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the development server**

   ```bash
   npm run dev
   ```

   This will start both the backend API server and the frontend development server.

3. **Access the application**

   Open your browser and navigate to:
   - Web application: `http://localhost:5000`
   - Admin interface: `http://localhost:5000/admin`

## Deployment Options

### GitHub Pages (Frontend Only)

For a static frontend-only deployment:

1. Update `vite.config.ts` to include the base path:

   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
     // ...other config
   });
   ```

2. Add a GitHub workflow file in `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]

   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
         - name: Install dependencies
           run: npm ci
         - name: Build
           run: npm run build
         - name: Deploy to GitHub Pages
           uses: JamesIves/github-pages-deploy-action@v4
           with:
             branch: gh-pages
             folder: dist
   ```

3. Push changes to GitHub to trigger the workflow.

### Full Stack Deployment

For full-stack functionality, consider these options:

1. **GitHub Actions with Self-Hosted Runner**

   Set up a self-hosted runner to deploy to your own server:
   
   ```yaml
   # .github/workflows/deploy-full.yml
   name: Deploy Full Application

   on:
     push:
       branches: [ main ]

   jobs:
     deploy:
       runs-on: self-hosted
       steps:
         - uses: actions/checkout@v3
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
         - name: Install dependencies
           run: npm ci
         - name: Build
           run: npm run build
         - name: Restart Service
           run: pm2 restart wovie-app || pm2 start npm --name "wovie-app" -- start
   ```

2. **GitHub Integration with Cloud Platforms**

   - **Vercel**: Connect your GitHub repository to Vercel for automatic deployments
   - **Netlify**: Similar to Vercel, with easy GitHub integration
   - **Railway**: Supports full-stack applications with easy GitHub integration

## Telegram Bot Integration

After deployment, your Telegram bot needs to be configured:

1. **Start the bot**: Send `/start` to your bot on Telegram
2. **Authenticate**: Send `/admin [your_admin_password]` to authenticate
3. **Configure channel storage**: Use the `/channel` command and follow instructions
4. **Verify it works**: Use `/stats` to check if the system is running properly

## Troubleshooting

### Common Issues and Solutions

1. **Telegram bot not starting**
   - Verify `TELEGRAM_BOT_TOKEN` is correct
   - Ensure the bot hasn't been revoked or blocked
   - Check server logs for errors

2. **Channel storage not working**
   - Ensure bot has admin privileges in the channel
   - Verify `TELEGRAM_CHANNEL_ID` is correct
   - Check if channel is public or the bot has proper access

3. **Application error on startup**
   - Check if all environment variables are properly set
   - Review server logs for specific error messages
   - Verify node and npm versions meet requirements

4. **Web scraping not working**
   - Ensure the domains are properly whitelisted
   - Check if the target site has changed its structure
   - Verify if puppeteer dependencies are installed correctly

### Getting Help

If you encounter issues not covered in this guide:

1. Check the GitHub repository Issues tab
2. Open a new issue with detailed information about your problem
3. Include relevant logs and environment details (excluding sensitive information)

---

## Security Notes

- Never commit your `.env` file to GitHub
- Use GitHub secrets for any CI/CD workflows
- Regularly rotate your admin passwords and tokens
- Consider implementing rate limiting for production deployments

---

*This guide is subject to updates as the project evolves. Last updated: April 2025.*