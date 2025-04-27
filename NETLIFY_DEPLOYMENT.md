# Netlify Deployment Guide

This document explains how to deploy this application to Netlify. Our setup uses a special configuration to handle the transition from a full-stack application to a Netlify-hosted frontend with serverless functions.

## Pre-requisites

- A Netlify account
- Git repository containing the project
- Basic understanding of Netlify deployment process

## Deployment Steps

1. **Prepare Your Repository**
   - Make sure all the Netlify configuration files are in your repository:
     - `netlify.toml` - Netlify configuration
     - `netlify-build.js` - Custom build script
     - `netlify-package.json` - Specialized package.json for Netlify
     - `vite.netlify.config.js` - Simplified Vite configuration for Netlify
     - `netlify/functions/api.js` - API function for Netlify

2. **Push Code to Git Repository**
   - Commit all changes to your repository
   - Push to GitHub, GitLab, or Bitbucket

3. **Connect to Netlify**
   - Log in to your Netlify account
   - Click "Add new site" > "Import an existing project"
   - Connect to your Git provider and select the repository

4. **Configure Build Settings**
   - Build command: `cp netlify-package.json package.json && npm ci && node netlify-build.js`
   - Publish directory: `dist/public`
   - This specialized build command will:
     1. Replace the package.json with our Netlify-specific version
     2. Install only the dependencies needed for the build
     3. Run our custom build script

5. **Configure Environment Variables**
   - Click "Advanced build settings" to add environment variables
   - Add `VITE_NETLIFY=true` to enable Netlify-specific configurations
   - Other optional variables:
     - `NODE_VERSION`: Set to `16` or higher if you encounter Node.js compatibility issues

6. **Deploy Site**
   - Click "Deploy site"
   - Netlify will build and deploy your application

7. **Verify Deployment**
   - Once deployed, check that your site works correctly
   - Test navigation and any client-side functionality
   - Verify that API endpoints through Netlify Functions are working

## How It Works

Our Netlify deployment uses a specialized architecture:

### Key Files

- `netlify.toml`: Main Netlify configuration file that defines build settings, redirects, and function locations
- `netlify-build.js`: Custom CommonJS build script that handles building both frontend and serverless functions
- `netlify/functions/api.js`: Netlify Function that provides a simplified API layer
- `client/src/lib/netlify-config.ts`: Detects when running in Netlify to adjust API endpoints
- `client/src/lib/netlify-api.ts`: API utilities specific to the Netlify environment
- `vite.netlify.config.js`: Simplified Vite configuration without external plugins
- `netlify-package.json`: Minimal package.json with only the dependencies needed for building

### Architecture Differences

In the Netlify deployment, we make several adjustments from the full-stack version:

1. **Frontend Remains Intact**: The React frontend works mostly the same
2. **Backend API → Netlify Functions**: API endpoints are reimplemented as serverless functions
3. **Data Access**: Simplified data access with static responses or optional database connections

## Limitations

Since this is a static deployment on Netlify with serverless functions, there are some limitations:

1. No persistent database (data is reset on each deployment)
2. Limited server-side functionality compared to the full Express backend
3. API responses are simplified mock data

## Troubleshooting

If you encounter issues with the deployment:

1. Check the Netlify deployment logs for errors
2. Verify that all dependencies are installed correctly
3. Make sure the build script is running properly
4. Check that all environment variables are set correctly

## Local Testing of Netlify Build

To test the Netlify build process locally before deploying:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run the build
node netlify-build.js

# Start Netlify dev server
netlify dev
```

This will simulate the Netlify environment locally.