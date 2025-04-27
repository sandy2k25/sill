# WovIeX Netlify Deployment Guide

This comprehensive guide explains how to deploy the WovIeX application to Netlify, including setting up serverless functions to replace the backend API.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Netlify Functions](#netlify-functions)
5. [Deployment Methods](#deployment-methods)
6. [Environment Variables](#environment-variables)
7. [Post-Deployment Steps](#post-deployment-steps)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

## Overview

Deploying WovIeX to Netlify involves:

1. Setting up the frontend as a static site
2. Creating serverless functions to replace the backend API
3. Configuring environment variables and build settings
4. Deploying the application

## Prerequisites

Before starting, ensure you have:

- A [Netlify account](https://app.netlify.com/signup)
- [Git](https://git-scm.com/) installed
- [Node.js](https://nodejs.org/) (v14 or later) installed
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (optional, for local testing)

## Project Setup

1. **Configure Project for Netlify**

   The project has already been configured with the following files:
   
   - `netlify.toml`: Netlify configuration
   - `netlify/functions/`: Directory containing serverless functions
   - `prepare-netlify-deploy.js`: Script to prepare the project for deployment

2. **Run the Preparation Script**

   ```bash
   node prepare-netlify-deploy.js
   ```

   This script:
   - Replaces package.json with Netlify-specific version
   - Ensures vite.netlify.config.js exists for Netlify compatibility
   - Installs dependencies
   - Builds the application with the Netlify-specific configuration
   - Creates necessary redirects and configuration files

3. **Update API Endpoints** (Optional)

   If you need to make any custom changes to API endpoints, modify the files in `netlify/functions/` directory before deployment.

## Netlify Functions

Netlify Functions serve as the backend API for your application:

| Function | Purpose | Endpoints |
|----------|---------|-----------|
| `auth.js` | User authentication | `/api/auth/login`, `/api/auth/verify` |
| `video.js` | Video scraping and management | `/api/video/:id`, `/api/cache/clear`, `/api/settings` |
| `domains.js` | Domain whitelist management | `/api/domains`, `/api/domains/:id/toggle`, `/api/domains/check` |

These functions are deployed automatically with your Netlify site and provide equivalent functionality to the Express backend in the original application.

## Deployment Methods

### Method 1: Netlify CLI (Recommended for Testing)

1. **Install Netlify CLI**

   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**

   ```bash
   netlify login
   ```

3. **Initialize Netlify Site**

   ```bash
   netlify init
   ```

   Follow the prompts to create a new site or link to an existing one.

4. **Test Locally**

   ```bash
   netlify dev
   ```

   This starts a local development server with Netlify Functions enabled.

5. **Deploy to Netlify**

   ```bash
   netlify deploy --prod
   ```

### Method 2: GitHub Integration (Recommended for Production)

1. **Push Your Code to GitHub**

   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push
   ```

2. **Connect to Netlify**

   - Go to [Netlify](https://app.netlify.com/)
   - Click "New site from Git"
   - Select GitHub as your provider
   - Authorize Netlify to access your repositories
   - Select your repository

3. **Configure Build Settings**

   - Build command: `npm ci && npm run build -- --config vite.netlify.config.js`
   - Publish directory: `dist/public`
   - Click "Advanced" and add the environment variables (see below)

4. **Deploy the Site**

   Click "Deploy site" to start the deployment process.

## Environment Variables

Set the following environment variables in your Netlify dashboard:

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-secure-jwt-secret` |
| `ADMIN_PASSWORD` | Admin login password | `your-secure-admin-password` |
| `ADMIN_API_KEY` | API key for admin functions | `your-secure-api-key` |
| `NODE_ENV` | Environment mode | `production` |

To set these variables:

1. Go to your site dashboard on Netlify
2. Navigate to Site settings > Build & deploy > Environment
3. Click "Edit variables" and add each variable

## Post-Deployment Steps

After successful deployment:

1. **Access Your Site**

   Your site will be available at `https://your-site-name.netlify.app`

2. **Test Admin Login**

   - Go to `/nimda` on your deployed site
   - Login with username `admin` and the password you set in environment variables

3. **Configure Domain Whitelist**

   - Login to the admin interface
   - Navigate to the Domains section
   - Add your custom domain and other domains you want to whitelist

4. **Set Up Custom Domain** (Optional)

   - In your Netlify dashboard, go to Site settings > Domain management
   - Click "Add custom domain"
   - Follow the instructions to configure DNS settings

## Troubleshooting

### Common Issues

1. **Functions Not Working**

   - Check Netlify Functions logs in your site dashboard
   - Verify environment variables are set correctly
   - Ensure your function code doesn't have syntax errors

   Functions logs can be found in:
   Site dashboard > Functions > Select function > View logs

2. **API Endpoints Return 404**

   - Ensure paths in your frontend code match the function paths
   - Check the Netlify redirects are working properly
   - Verify the function code is handling routes correctly

3. **Authentication Issues**

   - Check that `JWT_SECRET` and `ADMIN_PASSWORD` environment variables are set
   - Clear browser cache and cookies
   - Try logging in with the correct credentials

4. **Build Failures**

   - Review build logs in the Netlify dashboard
   - Fix any errors in your code
   - Ensure all dependencies are correctly specified in package.json
   
5. **"Cannot find package '@vitejs/plugin-react'" Error**

   This error occurs because the build process can't find the required dependencies. To fix it:
   
   - Make sure you've run `node prepare-netlify-deploy.js` before deploying
   - Use the package.netlify.json which includes all necessary dependencies
   - In Netlify dashboard, change the build command to: `npm ci && npm run build -- --config vite.netlify.config.js`
   - Check that your vite.netlify.config.js uses only dependencies specified in package.json

## Maintenance

### Updating Your Application

1. **Make Changes Locally**

   Update your code, test it locally with `netlify dev`

2. **Commit and Push Changes**

   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

3. **Deploy Changes**

   If using GitHub integration, changes will deploy automatically.
   
   If using Netlify CLI:
   ```bash
   netlify deploy --prod
   ```

### Monitoring

Monitor your application performance and function executions in the Netlify dashboard:

- Site dashboard > Analytics: Overall site performance
- Site dashboard > Functions: Function performance and logs
- Site dashboard > Deploys: Deployment history and logs

### Limitations and Considerations

1. **Cold Starts**

   Netlify Functions may experience "cold starts" when they haven't been used for a while. This can cause the first request to be slower.

2. **Execution Limits**

   Netlify Functions have execution limits:
   - Timeout: 10 seconds (26 seconds on paid plans)
   - Memory: 1024 MB
   - Payload size: 6 MB

3. **Statelessness**

   Functions are stateless, meaning they don't maintain state between invocations. For persistent storage, consider using:
   
   - Netlify Identity for user management
   - FaunaDB or similar for database needs
   - External APIs for additional functionality

## Additional Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)

---

*This documentation was last updated in April 2025*