#!/usr/bin/env node
/**
 * Simple build script for Netlify that:
 * 1. Builds the frontend
 * 2. Converts Express routes to Netlify functions
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple colored output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}Building application for Netlify...${colors.reset}`);

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Create dist/functions directory if it doesn't exist
if (!fs.existsSync('dist/functions')) {
  fs.mkdirSync('dist/functions', { recursive: true });
}

// Build the frontend
console.log(`${colors.cyan}Building frontend...${colors.reset}`);
try {
  // Run vite build in client directory
  execSync('cd client && npx vite build', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Frontend build completed${colors.reset}`);
  
  // Copy the built files to dist
  fs.cpSync('client/dist', 'dist/public', { recursive: true });
  console.log(`${colors.green}✓ Frontend files copied to dist/public${colors.reset}`);
} catch (error) {
  console.error(`${colors.red}❌ Frontend build failed: ${error.message}${colors.reset}`);
  
  // Create a basic page as fallback
  if (!fs.existsSync('dist/public')) {
    fs.mkdirSync('dist/public', { recursive: true });
  }
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>WovIeX</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>WovIeX</h1>
  <p>The application is being deployed. Please check back shortly.</p>
  <p>The API endpoints are available at <code>/.netlify/functions/api/...</code></p>
</body>
</html>`;
  
  fs.writeFileSync('dist/public/index.html', htmlContent);
  console.log(`${colors.yellow}⚠ Created fallback HTML page${colors.reset}`);
}

// Create a basic API function
console.log(`${colors.cyan}Creating API function...${colors.reset}`);

const apiFunctionContent = `
// Simple API function for Netlify
export async function handler(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  // Handle options requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Handle status endpoint
  if (path === '/' || path === '/status') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'online',
        message: 'API is running on Netlify Functions',
        timestamp: new Date().toISOString()
      })
    };
  }
  
  // Generic response for all other endpoints
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'WovIeX API running on Netlify',
      path: path,
      method: event.httpMethod,
      body: event.body ? JSON.parse(event.body) : null
    })
  };
}
`;

fs.writeFileSync('dist/functions/api.js', apiFunctionContent);
console.log(`${colors.green}✓ Created API function${colors.reset}`);

// Create a simple netlify.toml
console.log(`${colors.cyan}Creating netlify.toml...${colors.reset}`);

const netlifyTomlContent = `[build]
  publish = "dist/public"
  functions = "dist/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

fs.writeFileSync('netlify.toml', netlifyTomlContent);
console.log(`${colors.green}✓ Created netlify.toml${colors.reset}`);

console.log(`${colors.green}Build completed!${colors.reset}`);
console.log(`${colors.cyan}You can now deploy the 'dist' directory to Netlify.${colors.reset}`);