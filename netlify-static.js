#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Starting Netlify static build process...${colors.reset}`);

// Create output directories
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}
if (!fs.existsSync('dist/public')) {
  fs.mkdirSync('dist/public', { recursive: true });
}
if (!fs.existsSync('dist/functions')) {
  fs.mkdirSync('dist/functions', { recursive: true });
}

// Create a simplified static HTML file
console.log(`${colors.yellow}Creating static HTML file...${colors.reset}`);
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WovIeX - Static Version</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-top: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .btn {
      display: inline-block;
      background: #3498db;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      margin-top: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 0.9rem;
      color: #7f8c8d;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>WovIeX - Netlify Static Version</h1>
    
    <div class="card">
      <h2>Welcome to WovIeX</h2>
      <p>This is a static placeholder for the WovIeX application. The full version is available at the main deployment URL.</p>
      <p>This static version demonstrates successful deployment to Netlify, but does not include the full application features which require a proper server environment.</p>
    </div>
    
    <div class="card">
      <h2>Features</h2>
      <ul>
        <li>Video management and extraction</li>
        <li>Domain whitelisting</li>
        <li>Administrative controls</li>
        <li>Telegram integration</li>
      </ul>
      <a href="https://github.com" class="btn">View Source</a>
    </div>
  </div>
  
  <div class="footer">
    <p>© ${new Date().getFullYear()} WovIeX - A sophisticated web video extraction platform</p>
  </div>
</body>
</html>`;

fs.writeFileSync('dist/public/index.html', htmlContent);
console.log(`${colors.green}✓ Created index.html${colors.reset}`);

// Create a simple Netlify function for API
console.log(`${colors.yellow}Creating Netlify function...${colors.reset}`);
const functionContent = `// Netlify Function for API requests
exports.handler = async function(event, context) {
  // Extract the path from the request
  const path = event.path.replace('/.netlify/functions/api', '');
  
  // Basic routing for common API endpoints
  if (path.includes('/videos') || path === '/api/videos') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Static API response from Netlify function",
        data: {
          videos: [
            { 
              id: 1, 
              title: "Sample Video", 
              videoId: "sample123", 
              url: "https://example.com/video.mp4",
              createdAt: new Date().toISOString(),
              accessCount: 123
            }
          ]
        }
      }),
      headers: { "Content-Type": "application/json" }
    };
  }
  
  // Default response
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "WovIeX API Static Response",
      path: path,
      note: "This is a static response. The full API requires a proper server environment."
    }),
    headers: { "Content-Type": "application/json" }
  };
};`;

fs.writeFileSync('dist/functions/api.js', functionContent);
console.log(`${colors.green}✓ Created API function${colors.reset}`);

// Create a _redirects file for Netlify
console.log(`${colors.yellow}Creating Netlify redirects...${colors.reset}`);
const redirectsContent = `/api/*    /.netlify/functions/api/:splat    200
/*        /index.html                200`;

fs.writeFileSync('dist/public/_redirects', redirectsContent);
console.log(`${colors.green}✓ Created _redirects file${colors.reset}`);

console.log(`${colors.green}Static build completed successfully!${colors.reset}`);
console.log(`${colors.cyan}The build has created:${colors.reset}`);
console.log(`- A static HTML page in dist/public/index.html`);
console.log(`- A Netlify Function in dist/functions/api.js`);
console.log(`- Netlify redirects in dist/public/_redirects`);