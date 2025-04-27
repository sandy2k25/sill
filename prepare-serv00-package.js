/**
 * prepare-serv00-package.js
 * 
 * This script prepares a deployment package specifically optimized for serv00.com hosting.
 * It creates a minimal deployable package with only the necessary files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DEPLOY_DIR = path.join(__dirname, 'serv00-deploy');
const INCLUDE_NODE_MODULES = true; // Set to false if you'll install on the server

console.log('🚀 Preparing deployment package for serv00.com...');

// Create deployment directory
if (fs.existsSync(DEPLOY_DIR)) {
  console.log('Cleaning existing deployment directory...');
  fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
}

fs.mkdirSync(DEPLOY_DIR, { recursive: true });
fs.mkdirSync(path.join(DEPLOY_DIR, 'dist'), { recursive: true });

// Build the application
console.log('Building application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed. Please fix the errors and try again.');
  process.exit(1);
}

// Copy files
console.log('Copying files to deployment package...');

// Helper function to copy files
function copyFiles(source, dest) {
  if (!fs.existsSync(source)) {
    console.warn(`⚠️ Warning: ${source} does not exist, skipping...`);
    return;
  }
  
  if (fs.lstatSync(source).isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(source);
    for (const entry of entries) {
      const srcPath = path.join(source, entry);
      const destPath = path.join(dest, entry);
      copyFiles(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(source, dest);
  }
}

// Copy dist folder (compiled application)
copyFiles(path.join(__dirname, 'dist'), path.join(DEPLOY_DIR, 'dist'));

// Copy critical files
const criticalFiles = [
  'package.json',
  'package-lock.json',
  'player_template_simple.html',
  'drizzle.config.ts'
];

for (const file of criticalFiles) {
  if (fs.existsSync(path.join(__dirname, file))) {
    fs.copyFileSync(
      path.join(__dirname, file), 
      path.join(DEPLOY_DIR, file)
    );
    console.log(`Copied ${file}`);
  } else {
    console.warn(`⚠️ Warning: ${file} not found, skipping...`);
  }
}

// Copy node_modules if configured
if (INCLUDE_NODE_MODULES) {
  console.log('Copying node_modules (this may take a while)...');
  copyFiles(
    path.join(__dirname, 'node_modules'), 
    path.join(DEPLOY_DIR, 'node_modules')
  );
}

// Create production package.json
const packageJson = require('./package.json');
const prodPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  license: packageJson.license,
  scripts: {
    start: 'NODE_ENV=production node dist/index.js',
    'db:push': 'drizzle-kit push'
  },
  dependencies: packageJson.dependencies
};

// Write the simplified package.json
fs.writeFileSync(
  path.join(DEPLOY_DIR, 'package.json'),
  JSON.stringify(prodPackageJson, null, 2)
);

// Create starter script
const startScript = `#!/bin/bash
# Start script for serv00.com

# Configure environment variables (if not set in hosting panel)
export NODE_ENV=production
export PORT=5000

# Start the application
node dist/index.js
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'start.sh'), startScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'start.sh'), '755');

// Create PM2 ecosystem file
const ecosystemConfig = `module.exports = {
  apps: [{
    name: "wovie-scraper",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M"
  }]
};
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'ecosystem.config.js'), ecosystemConfig);

// Create .htaccess file for Apache
const htaccess = `# Redirect all requests to Node.js application
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ http://localhost:5000/ [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://localhost:5000/$1 [P,L]
</IfModule>

# Set headers for better security
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>
`;

fs.writeFileSync(path.join(DEPLOY_DIR, '.htaccess'), htaccess);

// Create README with instructions
const readme = `# WovIeX - serv00.com Deployment Package

This package contains a ready-to-deploy version of the WovIeX application, specifically optimized for serv00.com hosting.

## Deployment Instructions

1. Upload this entire directory to your serv00.com hosting account
2. Configure environment variables in serv00.com panel:
   - DATABASE_URL: Your PostgreSQL connection string
   - NODE_ENV: production
   - PORT: 5000 (or as required by serv00.com)
   - TELEGRAM_BOT_TOKEN: (optional) For Telegram integration
   - TELEGRAM_CHANNEL_ID: (optional) For Telegram storage
3. Run database migrations (via SSH):
   \`\`\`
   cd /path/to/your/uploaded/app
   npx drizzle-kit push
   \`\`\`
4. Start the application:
   - Using the provided start script: \`./start.sh\`
   - Or using PM2: \`pm2 start ecosystem.config.js\`
   - Or configure via serv00.com's application manager

## Important Files

- \`dist/\`: Compiled application
- \`start.sh\`: Simple startup script
- \`ecosystem.config.js\`: PM2 configuration
- \`.htaccess\`: Apache configuration (if applicable)
- \`player_template_simple.html\`: Required for video player

## Troubleshooting

If you encounter issues:
1. Check serv00.com's logs
2. Verify environment variables are set correctly
3. Ensure PostgreSQL is available and credentials are correct
4. Check if port 5000 is accessible

## Default Admin Credentials

Username: admin
Password: admin123

CHANGE THESE IMMEDIATELY after first login
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'README.md'), readme);

// Create environment template
const envTemplate = `# Environment Variables for serv00.com
# Copy these to your serv00.com environment settings

# Required
NODE_ENV=production
PORT=5000

# Database connection
# Replace with your serv00.com PostgreSQL credentials
DATABASE_URL=postgresql://username:password@localhost:5432/databasename

# Optional - for Telegram integration
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
`;

fs.writeFileSync(path.join(DEPLOY_DIR, '.env.template'), envTemplate);

console.log('✅ Deployment package created successfully!');
console.log(`📁 Location: ${DEPLOY_DIR}`);
console.log('📋 Next steps:');
console.log('  1. Upload the contents of this directory to serv00.com');
console.log('  2. Configure environment variables in serv00.com panel');
console.log('  3. Run database migrations');
console.log('  4. Start the application using provided scripts\n');