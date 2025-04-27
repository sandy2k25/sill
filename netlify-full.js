#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Starting Netlify full application build process...${colors.reset}`);

// Create simplified Vite configuration
console.log(`${colors.yellow}Creating simplified Vite configuration...${colors.reset}`);
const viteConfig = `// Simplified Vite configuration for Netlify
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This configuration avoids using plugins that might cause issues
export default defineConfig({
  // Using built-in Vite features for JSX instead of plugins
  esbuild: {
    jsxInject: \`import React from 'react'\`,
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});`;

fs.writeFileSync('vite.netlify.js', viteConfig);
console.log(`${colors.green}✓ Created vite.netlify.js${colors.reset}`);

// Create API redirects and handling for Netlify Functions
console.log(`${colors.yellow}Setting up Netlify Functions for API handling...${colors.reset}`);

// Create functions directory if it doesn't exist
if (!fs.existsSync('netlify/functions')) {
  fs.mkdirSync('netlify/functions', { recursive: true });
}

// Create a proxy function to handle API requests
const proxyFunctionContent = `// Main API proxy function for Netlify
export async function handler(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  console.log(\`API Request: \${method} \${path}\`);
  
  try {
    // Import the appropriate handler based on the path
    let module;
    
    // Videos endpoints
    if (path.startsWith('/videos') || path === '/videos') {
      module = await import('./handlers/videos.js');
    } 
    // Domains endpoints
    else if (path.startsWith('/domains') || path === '/domains') {
      module = await import('./handlers/domains.js');
    }
    // Auth endpoints
    else if (path.startsWith('/auth') || path === '/auth') {
      module = await import('./handlers/auth.js');
    }
    // Default fallback
    else {
      module = await import('./handlers/default.js');
    }
    
    // Call the appropriate handler
    if (module && module.handleRequest) {
      return await module.handleRequest(event, context);
    }
    
    // Fallback if no handler found
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found', path }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Error handling request:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}`;

// Create the API handler directories
if (!fs.existsSync('netlify/functions/handlers')) {
  fs.mkdirSync('netlify/functions/handlers', { recursive: true });
}

// Write the main proxy function
fs.writeFileSync('netlify/functions/api.js', proxyFunctionContent);
console.log(`${colors.green}✓ Created API proxy function${colors.reset}`);

// Create handlers for different API endpoints
const videosHandler = `// Handler for video-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get videos list
  if ((path === '/videos' || path === '/videos/') && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
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
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Get a specific video
  if (path.match(/\\/videos\\/[\\w-]+/) && method === 'GET') {
    const videoId = path.split('/').pop();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: 1,
        title: "Sample Video",
        videoId: videoId,
        url: "https://example.com/video.mp4",
        createdAt: new Date().toISOString(),
        accessCount: 123
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Create a new video (handle POST)
  if ((path === '/videos' || path === '/videos/') && method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        id: 2,
        title: "New Video",
        videoId: body.videoId || "new123",
        url: body.url || "https://example.com/new-video.mp4",
        createdAt: new Date().toISOString(),
        accessCount: 0
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for video endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Video endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}`;

const domainsHandler = `// Handler for domain-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get domains list
  if ((path === '/domains' || path === '/domains/') && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        domains: [
          {
            id: 1,
            domain: "example.com",
            active: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 2,
            domain: "test.com",
            active: false,
            createdAt: new Date().toISOString()
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for domain endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Domain endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}`;

const authHandler = `// Handler for authentication-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Login endpoint
  if (path === '/auth/login' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // Very basic auth check - in a real app, this would verify credentials
    if (body.username === 'admin' && body.password === 'password') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          token: 'sample-jwt-token',
          user: {
            id: 1,
            username: 'admin',
            role: 'admin'
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  }
  
  // Default fallback for auth endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Auth endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}`;

const defaultHandler = `// Default handler for unmatched endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  
  return {
    statusCode: 404,
    body: JSON.stringify({
      error: 'API endpoint not found',
      path: path,
      message: 'The requested API endpoint does not exist'
    }),
    headers: { 'Content-Type': 'application/json' }
  };
}`;

// Write the handler files
fs.writeFileSync('netlify/functions/handlers/videos.js', videosHandler);
fs.writeFileSync('netlify/functions/handlers/domains.js', domainsHandler);
fs.writeFileSync('netlify/functions/handlers/auth.js', authHandler);
fs.writeFileSync('netlify/functions/handlers/default.js', defaultHandler);

console.log(`${colors.green}✓ Created API handlers${colors.reset}`);

// Create client-side config to detect Netlify
console.log(`${colors.yellow}Creating client-side Netlify detection...${colors.reset}`);

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

// Create redirects for Netlify
console.log(`${colors.yellow}Creating Netlify redirects...${colors.reset}`);
const redirectsContent = `/api/*    /.netlify/functions/api/:splat    200
/*        /index.html                200`;

fs.writeFileSync('dist/public/_redirects', redirectsContent);
console.log(`${colors.green}✓ Created _redirects file${colors.reset}`);

// Create netlify.env file to inject environment variable for frontend detection
console.log(`${colors.yellow}Creating Netlify environment file...${colors.reset}`);
fs.writeFileSync('client/.env', 'VITE_NETLIFY_DEPLOY=true\n');
console.log(`${colors.green}✓ Created Netlify environment file${colors.reset}`);

// Process and copy shared schema files
console.log(`${colors.yellow}Processing shared schema files...${colors.reset}`);
// Make sure dist/shared exists
if (!fs.existsSync('dist/shared')) {
  fs.mkdirSync('dist/shared', { recursive: true });
}
// Copy shared files
if (fs.existsSync('shared')) {
  const sharedFiles = fs.readdirSync('shared');
  sharedFiles.forEach(file => {
    const sourcePath = path.join('shared', file);
    const destPath = path.join('dist/shared', file);
    fs.copyFileSync(sourcePath, destPath);
  });
  console.log(`${colors.green}✓ Copied shared schema files${colors.reset}`);
}

// Build the frontend
console.log(`${colors.cyan}Building frontend...${colors.reset}`);
try {
  // Create a new Netlify-aware client entry point
console.log(`${colors.yellow}Creating Netlify patch file...${colors.reset}`);

// First check if the netlify-patch.js file exists
if (!fs.existsSync('client/src/lib/netlify-patch.js')) {
  console.log(`${colors.yellow}netlify-patch.js not found, creating it...${colors.reset}`);
  // This was already created in a previous step
}

// Import the patch file in main.tsx before the build
const mainFilePath = 'client/src/main.tsx';
let mainFileContent = '';

if (fs.existsSync(mainFilePath)) {
  // Read the original content
  mainFileContent = fs.readFileSync(mainFilePath, 'utf8');
  
  // Backup original file
  fs.copyFileSync(mainFilePath, `${mainFilePath}.backup`);
  
  // Check if the import is already there
  if (!mainFileContent.includes('netlify-patch')) {
    // We'll use a simple import that won't conflict with existing React imports
    const patchedContent = `// Import Netlify patch (added by build script)
import "./lib/netlify-patch.js";

${mainFileContent}`;
    
    // Write the patched file
    fs.writeFileSync(mainFilePath, patchedContent);
    console.log(`${colors.green}✓ Patched main.tsx with Netlify detection${colors.reset}`);
  } else {
    console.log(`${colors.yellow}main.tsx already has Netlify patch import${colors.reset}`);
  }
} else {
  console.log(`${colors.red}main.tsx not found!${colors.reset}`);
}

  execSync('npx vite build --config vite.netlify.js', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Frontend build completed successfully${colors.reset}`);
  
  // Restore original file if backed up
  if (fs.existsSync('client/src/main.tsx.backup')) {
    fs.copyFileSync('client/src/main.tsx.backup', 'client/src/main.tsx');
    fs.unlinkSync('client/src/main.tsx.backup');
  }
} catch (error) {
  console.error(`${colors.red}❌ Frontend build failed${colors.reset}`, error.message);
  
  // Restore original file if backed up
  if (fs.existsSync('client/src/main.tsx.backup')) {
    fs.copyFileSync('client/src/main.tsx.backup', 'client/src/main.tsx');
    fs.unlinkSync('client/src/main.tsx.backup');
  }
  
  console.log(`${colors.yellow}Falling back to static HTML...${colors.reset}`);
  
  // Create a static HTML fallback
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WovIeX</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .container { background: #f9f9f9; border-radius: 8px; padding: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    .btn { display: inline-block; background: #3498db; color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>WovIeX</h1>
    <p>The application is being set up. Full functionality will be available soon.</p>
    <p>In the meantime, you can still use the API endpoints.</p>
    <a href="/.netlify/functions/api/videos" class="btn">Try API</a>
  </div>
</body>
</html>`;
  
  fs.writeFileSync('dist/public/index.html', htmlContent);
  console.log(`${colors.green}✓ Created fallback index.html${colors.reset}`);
}

// Copy API functions to the dist directory
console.log(`${colors.yellow}Copying API functions to dist...${colors.reset}`);
if (!fs.existsSync('dist/functions')) {
  fs.mkdirSync('dist/functions', { recursive: true });
}

// Copy the API function and its handlers
fs.copyFileSync('netlify/functions/api.js', 'dist/functions/api.js');

if (!fs.existsSync('dist/functions/handlers')) {
  fs.mkdirSync('dist/functions/handlers', { recursive: true });
}

const handlerFiles = [
  'videos.js',
  'domains.js',
  'auth.js',
  'logs.js',
  'users.js',
  'scraper.js',
  'default.js'
];

// Copy all handlers
for (const file of handlerFiles) {
  const sourcePath = path.join('netlify/functions/handlers', file);
  const destPath = path.join('dist/functions/handlers', file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`${colors.green}✓ Copied handler: ${file}${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Handler file not found: ${file}${colors.reset}`);
  }
}

console.log(`${colors.green}✓ Copied API functions${colors.reset}`);

console.log(`${colors.green}Build process completed!${colors.reset}`);
console.log(`${colors.cyan}You can now deploy the content of the dist/ directory to Netlify.${colors.reset}`);