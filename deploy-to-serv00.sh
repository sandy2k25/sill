#!/bin/bash
# Deployment script for serv00.com hosting
# This script prepares your application for deployment and provides instructions

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== WovIeX Deployment Script for serv00.com ===${NC}"
echo -e "This script will prepare your application for deployment to serv00.com"

# Step 1: Build the application
echo -e "\n${YELLOW}Step 1: Building the application...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed. Please fix the errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Step 2: Create necessary directories for deployment
echo -e "\n${YELLOW}Step 2: Preparing deployment package...${NC}"

# Create deployment directory
mkdir -p deploy
mkdir -p deploy/dist

# Copy necessary files
cp -r dist/* deploy/dist/
cp package.json deploy/
cp player_template_simple.html deploy/
cp -r node_modules deploy/

# Create startup script
cat > deploy/start.sh << 'EOL'
#!/bin/bash
# Startup script for serv00.com

# Set environment variables if not already set
export NODE_ENV=production
export PORT=5000
# You will need to manually set DATABASE_URL, TELEGRAM_BOT_TOKEN, and TELEGRAM_CHANNEL_ID in serv00.com panel

# Start the application
node dist/index.js
EOL

chmod +x deploy/start.sh

# Create environment setup file (template to be filled)
cat > deploy/setup-env.txt << 'EOL'
# Environment Variables for serv00.com
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
EOL

echo -e "${GREEN}Deployment package prepared in the 'deploy' directory${NC}"

# Create readme file with deployment instructions
cat > deploy/README.txt << 'EOL'
=== WovIeX Deployment Guide for serv00.com ===

Follow these steps to deploy your application on serv00.com:

1. UPLOAD FILES
   - Upload the entire contents of this 'deploy' directory to your serv00.com hosting account
   - You can use SFTP, SCP, or any file upload method supported by serv00.com

2. DATABASE SETUP
   - Log in to your serv00.com control panel
   - Create a new PostgreSQL database
   - Note the database name, username, password, host, and port
   - Update the DATABASE_URL environment variable with these credentials

3. ENVIRONMENT SETUP
   - In your serv00.com control panel, set up the environment variables listed in setup-env.txt
   - Make sure to update DATABASE_URL with your actual database credentials
   - Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID if you want Telegram integration

4. INITIAL SETUP
   - Connect to your serv00.com account via SSH
   - Navigate to your application directory
   - Run database migrations:
     $ npx drizzle-kit push
   - This will create all necessary database tables

5. START THE APPLICATION
   - Navigate to your application directory
   - Make the start script executable:
     $ chmod +x start.sh
   - Run the application:
     $ ./start.sh
   - Or configure this as a service/daemon in serv00.com's control panel

6. CONFIGURE DOMAIN AND HTTPS
   - Set up your domain in the serv00.com control panel
   - Configure HTTPS for secure connections (important for video streaming)
   - Make sure port 5000 is accessible or configure a proxy to forward traffic

7. TEST THE APPLICATION
   - Visit your domain in a web browser
   - Try accessing the admin area at /nimda
   - Test video scraping and streaming functionality

TROUBLESHOOTING:
- If the application doesn't start, check the logs provided by serv00.com
- Ensure all environment variables are set correctly
- Verify PostgreSQL is running and accessible
- Make sure port 5000 is not blocked by serv00.com's firewall

For advanced configuration, you may need to:
- Set up a process manager like PM2 to keep the application running
- Configure a reverse proxy with Nginx if needed
- Set up SSL certificates for HTTPS

The application is designed to use HTTP scraping in production, so puppeteer
dependencies are not critical for basic functionality.
EOL

# Create .htaccess file for Apache hosting (common on shared hosts)
cat > deploy/.htaccess << 'EOL'
# Redirect all requests to Node.js application
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
EOL

echo -e "\n${GREEN}Deployment instructions created in deploy/README.txt${NC}"
echo -e "${YELLOW}Upload the contents of the 'deploy' directory to your serv00.com hosting account${NC}"
echo -e "${YELLOW}Follow the instructions in README.txt to complete the deployment${NC}"

# Create configuration file for PM2 (process manager)
cat > deploy/ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: "wovie-scraper",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 5000
      // Other environment variables should be configured in serv00.com panel
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M"
  }]
};
EOL

echo -e "\n${GREEN}Deployment preparation completed!${NC}"
echo -e "${YELLOW}Final Notes:${NC}"
echo -e "1. Make sure serv00.com supports Node.js applications"
echo -e "2. Ensure PostgreSQL is available on your hosting plan"
echo -e "3. Check if port 5000 is accessible or configure a different port"
echo -e "4. If using Telegram integration, make sure outbound connections are allowed"
echo -e "\n${GREEN}Good luck with your deployment!${NC}"