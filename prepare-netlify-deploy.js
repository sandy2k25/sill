/**
 * prepare-netlify-deploy.js
 * 
 * This script prepares the project for deployment to Netlify.
 * It modifies client code to use Netlify Functions instead of the regular API.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

console.log(`${colors.bright}${colors.cyan}Preparing project for Netlify deployment...${colors.reset}\n`);

// Ensure netlify directory exists
if (!fs.existsSync('netlify/functions')) {
  console.log(`${colors.yellow}Creating netlify/functions directory...${colors.reset}`);
  fs.mkdirSync('netlify/functions', { recursive: true });
}

// Check if netlify.toml exists
if (!fs.existsSync('netlify.toml')) {
  console.log(`${colors.red}❌ netlify.toml not found. Please create it first.${colors.reset}`);
  process.exit(1);
}

// Check if serverless functions exist
const requiredFunctions = ['auth.js', 'video.js', 'domains.js'];
let missingFunctions = false;

for (const func of requiredFunctions) {
  const funcPath = path.join('netlify/functions', func);
  if (!fs.existsSync(funcPath)) {
    console.log(`${colors.red}❌ Missing serverless function: ${funcPath}${colors.reset}`);
    missingFunctions = true;
  }
}

if (missingFunctions) {
  console.log(`${colors.red}Please create the missing functions before continuing.${colors.reset}`);
  process.exit(1);
}

// Use Netlify-specific package.json and Vite config
console.log(`${colors.yellow}Setting up Netlify-specific configuration files...${colors.reset}`);

if (fs.existsSync('package.netlify.json')) {
  console.log(`Copying package.netlify.json to package.json`);
  fs.copyFileSync('package.netlify.json', 'package.json');
} else {
  console.log(`${colors.red}⚠️ package.netlify.json not found. Using existing package.json${colors.reset}`);
}

if (!fs.existsSync('vite.netlify.config.js')) {
  console.log(`${colors.red}⚠️ vite.netlify.config.js not found. Creating a simplified version...${colors.reset}`);
  
  const viteConfigContent = `
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
});
  `;
  
  fs.writeFileSync('vite.netlify.config.js', viteConfigContent);
}

// Install dependencies
console.log(`${colors.yellow}Installing dependencies...${colors.reset}`);
try {
  execSync('npm ci', { stdio: 'inherit' });
} catch (error) {
  console.error(`${colors.red}❌ Dependency installation failed:${colors.reset}`, error.message);
  console.log(`${colors.yellow}Continuing anyway...${colors.reset}`);
}

// Build the application with Netlify-specific config
console.log(`${colors.yellow}Building the application with Netlify config...${colors.reset}`);
try {
  execSync('npm run build -- --config vite.netlify.config.js', { stdio: 'inherit' });
} catch (error) {
  console.error(`${colors.red}❌ Build failed:${colors.reset}`, error.message);
  process.exit(1);
}

console.log(`${colors.green}✅ Build completed successfully.${colors.reset}\n`);

// Create a netlify.redirects file for better handling of SPA routes
console.log(`${colors.yellow}Creating _redirects file...${colors.reset}`);
const redirectsContent = `# Netlify redirects file
# Handle SPA routing
/*    /index.html   200

`;

// Make sure the dist/public directory exists
if (!fs.existsSync('dist/public')) {
  fs.mkdirSync('dist/public', { recursive: true });
}

fs.writeFileSync(path.join('dist/public', '_redirects'), redirectsContent);
console.log(`${colors.green}✅ Created _redirects file.${colors.reset}\n`);

// Create a netlify environment variables file (sample for documentation)
console.log(`${colors.yellow}Creating sample environment variables file...${colors.reset}`);
const envSampleContent = `# Netlify Environment Variables
# Add these in your Netlify dashboard

# Authentication
JWT_SECRET=your_secure_jwt_secret_key
ADMIN_PASSWORD=your_admin_password
ADMIN_API_KEY=your_admin_api_key

# API Keys (if needed)
API_KEY=your_api_key_if_needed

# Other Configuration
NODE_ENV=production
`;

fs.writeFileSync('.env.netlify.sample', envSampleContent);
console.log(`${colors.green}✅ Created sample environment variables file.${colors.reset}\n`);

// Copy necessary files for Netlify Functions
console.log(`${colors.yellow}Ensuring Netlify Functions have necessary dependencies...${colors.reset}`);
const packageJsonPath = path.join('netlify', 'package.json');

const functionDeps = {
  "name": "wovie-netlify-functions",
  "version": "1.0.0",
  "description": "Netlify Functions for WovIeX Application",
  "dependencies": {
    "axios": "^1.3.4",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0"
  }
};

fs.writeFileSync(packageJsonPath, JSON.stringify(functionDeps, null, 2));
console.log(`${colors.green}✅ Created package.json for Netlify Functions.${colors.reset}\n`);

// Summary
console.log(`${colors.bright}${colors.green}Netlify deployment preparation complete!${colors.reset}`);
console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
console.log(`1. Deploy to Netlify using the Netlify CLI or GitHub integration`);
console.log(`2. Set up the environment variables in your Netlify dashboard`);
console.log(`3. Make sure you've configured the correct API endpoints in your client code\n`);
console.log(`${colors.yellow}See NETLIFY_DEPLOYMENT.md for complete instructions.${colors.reset}`);