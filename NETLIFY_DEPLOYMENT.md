# Netlify Deployment Guide

This document explains how to deploy the application to Netlify.

## Pre-requisites

- A Netlify account
- Git repository containing the project

## Deployment Steps

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Log in to your Netlify account and click "Add new site" > "Import an existing project"

3. Connect to your Git provider and select the repository

4. Configure the build settings:
   - Build command: `cp netlify-package.json package.json && npm ci && node netlify-build.js`
   - Publish directory: `dist/public`

5. (Optional) Configure environment variables:
   - Click "Advanced build settings" to add environment variables
   - Add `VITE_NETLIFY=true` to enable Netlify-specific configurations

6. Click "Deploy site"

## How It Works

The deployment process uses the following files:

- `netlify.toml`: Configuration file for Netlify deployment
- `netlify-build.js`: Custom build script that handles both frontend and backend builds
- `netlify/functions/api.js`: Netlify Function that handles API requests
- `client/src/lib/netlify-config.ts`: Client-side configuration to detect Netlify environment
- `client/src/lib/netlify-api.ts`: API utilities for the Netlify environment

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