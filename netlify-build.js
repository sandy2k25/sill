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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Starting Netlify build process...${colors.reset}`);

// Check if vite.netlify.config.js exists, if not, copy from the existing one
if (!fs.existsSync('vite.netlify.config.js')) {
  console.log(`${colors.yellow}Creating Netlify-specific Vite config...${colors.reset}`);
  
  const configContent = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// This is a simplified Vite configuration specifically for Netlify deployment
export default defineConfig({
  plugins: [react()],
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
  
  fs.writeFileSync('vite.netlify.config.js', configContent);
  console.log(`${colors.green}✓ Created vite.netlify.config.js${colors.reset}`);
}

// Run the Vite build with Netlify config
console.log(`${colors.cyan}Building frontend with Netlify config...${colors.reset}`);
try {
  execSync('npx vite build --config vite.netlify.config.js', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Frontend build completed successfully${colors.reset}`);
} catch (error) {
  console.error(`${colors.red}❌ Frontend build failed:${colors.reset}`, error.message);
  process.exit(1);
}

// Build the server functions
console.log(`${colors.cyan}Building backend functions...${colors.reset}`);
try {
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  console.log(`${colors.green}✓ Backend build completed successfully${colors.reset}`);
} catch (error) {
  console.error(`${colors.red}❌ Backend build failed:${colors.reset}`, error.message);
  process.exit(1);
}

// If the netlify/functions directory exists, copy its contents to dist/functions
if (fs.existsSync('netlify/functions')) {
  console.log(`${colors.cyan}Copying Netlify functions...${colors.reset}`);
  
  // Create dist/functions directory if it doesn't exist
  if (!fs.existsSync('dist/functions')) {
    fs.mkdirSync('dist/functions', { recursive: true });
  }
  
  // Copy all files from netlify/functions to dist/functions
  const functionFiles = fs.readdirSync('netlify/functions');
  for (const file of functionFiles) {
    const sourcePath = path.join('netlify/functions', file);
    const destPath = path.join('dist/functions', file);
    fs.copyFileSync(sourcePath, destPath);
  }
  
  console.log(`${colors.green}✓ Copied ${functionFiles.length} Netlify functions${colors.reset}`);
} else {
  // Create Netlify functions directory if it doesn't exist
  if (!fs.existsSync('dist/functions')) {
    fs.mkdirSync('dist/functions', { recursive: true });
  }
  
  // Create a simple Netlify function to handle API requests
  console.log(`${colors.cyan}Creating fallback Netlify function...${colors.reset}`);
  
  const netlifyFunction = `
// Netlify Function to handle API requests
export async function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "This is a Netlify function response. For full functionality, please use the actual backend server."
    }),
    headers: {
      "Content-Type": "application/json"
    }
  };
}
`;
  
  fs.writeFileSync('dist/functions/api.js', netlifyFunction);
}
console.log(`${colors.green}✓ Created Netlify function: api.js${colors.reset}`);

console.log(`${colors.green}Build process completed successfully!${colors.reset}`);