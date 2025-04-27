# Netlify Static Deployment Guide

This document explains how to deploy a static version of the application to Netlify.

## What This Approach Does

This approach creates a simple static deployment of the app on Netlify with:

1. A static HTML page explaining the application
2. A simple Netlify Function that provides static API responses
3. Proper redirects configuration

**Note:** This is a fallback approach for demonstration purposes when a full deployment is challenging. It does not include the full functionality of the application.

## Deployment Steps

1. **Prepare Your Repository**
   - Make sure these files are in your repository:
     - `netlify.toml`
     - `netlify-static.js`

2. **Push Code to Git Repository**
   - Commit all changes to your repository
   - Push to GitHub, GitLab, or Bitbucket

3. **Connect to Netlify**
   - Log in to your Netlify account
   - Click "Add new site" > "Import an existing project"
   - Connect to your Git provider and select the repository

4. **Configure Build Settings**
   - Build command: `node netlify-static.js`
   - Publish directory: `dist/public`

5. **Deploy Site**
   - Click "Deploy site"
   - Netlify will build and deploy your static application

## Key Files

- `netlify.toml`: Defines build settings and redirects
- `netlify-static.js`: Simple script that generates the static site and function

## Switching Back to Full Deployment

When you're ready to deploy the full application, you can:

1. Update `netlify.toml` to use the original build command:
   ```
   [build]
     command = "cp netlify-package.json package.json && npm ci && node netlify-build.js"
     publish = "dist/public"
   ```

2. Make sure your `vite.netlify.config.js` and other related files are correctly set up for the full deployment

## Why Use This Approach

This static deployment approach is useful when:

- You need to quickly demonstrate deployment on Netlify
- You're troubleshooting build issues with the full application
- You want a placeholder while developing the full deployment solution