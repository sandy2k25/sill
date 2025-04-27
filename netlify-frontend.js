#!/usr/bin/env node
/**
 * Build script for Netlify frontend-only deployment
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

console.log(`${colors.cyan}Building frontend for Netlify...${colors.reset}`);

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Create a production-ready API endpoint file
console.log(`${colors.yellow}Creating API configuration file...${colors.reset}`);

// Get the API URL from environment or use a default for local development
const apiBaseUrl = process.env.API_URL || 'http://localhost:5000';

const apiConfigContent = `/**
 * API configuration for production
 * This file is auto-generated during the build process
 */

// The base URL for API requests
export const API_BASE_URL = "${apiBaseUrl}";

// Helper to make API requests
export async function fetchApi(endpoint, options = {}) {
  const url = endpoint.startsWith('/')
    ? \`\${API_BASE_URL}\${endpoint}\`
    : \`\${API_BASE_URL}/\${endpoint}\`;
    
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = new Error(\`API request failed with status \${response.status}\`);
    try {
      error.data = await response.json();
    } catch (e) {
      error.data = null;
    }
    throw error;
  }
  
  return response.json();
}

export default {
  API_BASE_URL,
  fetchApi
};
`;

// Create client/src/api-config.js file
const apiConfigPath = path.join('client', 'src', 'api-config.js');
fs.writeFileSync(apiConfigPath, apiConfigContent);
console.log(`${colors.green}✓ Created API configuration at ${apiConfigPath}${colors.reset}`);

// Modify the main entry file to use this config
const mainTsxPath = path.join('client', 'src', 'main.tsx');

if (fs.existsSync(mainTsxPath)) {
  // Create a backup of the original file
  fs.copyFileSync(mainTsxPath, `${mainTsxPath}.backup`);
  
  // Read the content
  let mainTsxContent = fs.readFileSync(mainTsxPath, 'utf8');
  
  // Check if we need to add the import
  if (!mainTsxContent.includes('api-config')) {
    // Add import at the top of the file
    mainTsxContent = `// Import API configuration
import './api-config.js';

${mainTsxContent}`;
    
    // Write the modified file
    fs.writeFileSync(mainTsxPath, mainTsxContent);
    console.log(`${colors.green}✓ Updated ${mainTsxPath} with API configuration${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ API configuration import already exists in ${mainTsxPath}${colors.reset}`);
  }
}

// Build the frontend
console.log(`${colors.cyan}Building frontend...${colors.reset}`);
try {
  // Run vite build in client directory
  execSync('cd client && npx vite build', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Frontend build completed${colors.reset}`);
  
  // Copy the built files to dist
  fs.cpSync('client/dist', 'dist', { recursive: true });
  console.log(`${colors.green}✓ Frontend files copied to dist${colors.reset}`);
  
  // Restore the original main.tsx if we modified it
  if (fs.existsSync(`${mainTsxPath}.backup`)) {
    fs.copyFileSync(`${mainTsxPath}.backup`, mainTsxPath);
    fs.unlinkSync(`${mainTsxPath}.backup`);
    console.log(`${colors.green}✓ Restored original ${mainTsxPath}${colors.reset}`);
  }
} catch (error) {
  console.error(`${colors.red}❌ Frontend build failed: ${error.message}${colors.reset}`);
  
  // Restore the original main.tsx if we modified it
  if (fs.existsSync(`${mainTsxPath}.backup`)) {
    fs.copyFileSync(`${mainTsxPath}.backup`, mainTsxPath);
    fs.unlinkSync(`${mainTsxPath}.backup`);
    console.log(`${colors.green}✓ Restored original ${mainTsxPath}${colors.reset}`);
  }
  
  process.exit(1);
}

console.log(`${colors.green}Build completed!${colors.reset}`);
console.log(`${colors.cyan}You can now deploy the 'dist' directory to Netlify.${colors.reset}`);