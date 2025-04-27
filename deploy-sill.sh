#!/bin/bash
# Deployment script for Sill project (https://github.com/sandy2k25/sill)
# This script prepares the application for deployment to serv00.net

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== Sill Deployment Script for serv00.net =====${NC}"
echo -e "This script prepares the Sill application for deployment"
echo -e "GitHub: https://github.com/sandy2k25/sill\n"

# Step 1: Clone the repository if not already in it
if [ ! -f "./package.json" ]; then
  echo -e "${YELLOW}Step 1: Cloning the Sill repository...${NC}"
  git clone https://github.com/sandy2k25/sill.git
  cd sill
  echo -e "${GREEN}Repository cloned successfully!${NC}"
else
  echo -e "${YELLOW}Step 1: Already in a project directory, checking if it's Sill...${NC}"
  
  # Simple check if we're in the right repository
  if grep -q "rest-express" "./package.json"; then
    echo -e "${GREEN}Confirmed: Working with Sill project.${NC}"
  else
    echo -e "${RED}Warning: This doesn't appear to be the Sill project.${NC}"
    echo -e "${YELLOW}Continue anyway? (y/n)${NC}"
    read response
    if [ "$response" != "y" ]; then
      echo -e "${RED}Deployment aborted.${NC}"
      exit 1
    fi
  fi
fi

# Step 2: Install dependencies and build
echo -e "\n${YELLOW}Step 2: Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install dependencies. Please fix the errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}Dependencies installed successfully!${NC}"

echo -e "\n${YELLOW}Step 3: Building the application...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed. Please fix the errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Step 4: Create deployment package
echo -e "\n${YELLOW}Step 4: Creating deployment package...${NC}"

# Create and clean deployment directory
DEPLOY_DIR="sill-deploy"
if [ -d "$DEPLOY_DIR" ]; then
  rm -rf "$DEPLOY_DIR"
fi
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
echo "Copying dist folder..."
cp -r dist "$DEPLOY_DIR/"

echo "Copying essential files..."
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/" 2>/dev/null || true
cp player_template_simple.html "$DEPLOY_DIR/" 2>/dev/null || true
cp -r node_modules "$DEPLOY_DIR/" 2>/dev/null || true

# Create start script
echo "Creating start script..."
cat > "$DEPLOY_DIR/start.sh" << 'EOL'
#!/bin/bash
# Start script for Sill on serv00.net
export NODE_ENV=production
export PORT=5000
node dist/index.js
EOL
chmod +x "$DEPLOY_DIR/start.sh"

# Create PM2 ecosystem file
echo "Creating PM2 ecosystem file..."
cat > "$DEPLOY_DIR/ecosystem.config.js" << 'EOL'
module.exports = {
  apps: [{
    name: "sill",
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
EOL

# Create .htaccess for Apache hosting
echo "Creating .htaccess file..."
cat > "$DEPLOY_DIR/.htaccess" << 'EOL'
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

# Create environment template
echo "Creating environment template..."
cat > "$DEPLOY_DIR/.env.template" << 'EOL'
# Environment Variables for serv00.net
# Copy these to your serv00.net environment settings

# Required
NODE_ENV=production
PORT=5000

# Database connection
# Replace with your serv00.net PostgreSQL credentials
DATABASE_URL=postgresql://username:password@localhost:5432/databasename

# Optional - for Telegram integration
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
EOL

# Create README file
echo "Creating setup instructions..."
cat > "$DEPLOY_DIR/README.md" << 'EOL'
# Sill - serv00.net Deployment Package

This package contains a ready-to-deploy version of the Sill application from https://github.com/sandy2k25/sill.

## Deployment Instructions

1. **Upload Files**
   Upload all files in this directory to your serv00.net hosting account.

2. **Set Up Database**
   - Create a PostgreSQL database in your serv00.net control panel
   - Note the connection details (host, port, username, password, database name)

3. **Configure Environment Variables**
   In your serv00.net control panel, set:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
   
   For Telegram features (optional):
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHANNEL_ID=your_telegram_channel_id
   ```

4. **Initialize Database**
   Connect via SSH and run:
   ```
   cd /path/to/uploaded/files
   npx drizzle-kit push
   ```

5. **Start the Application**

   **Using PM2 (recommended):**
   ```
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

   **Using the start script:**
   ```
   ./start.sh
   ```

   **Using serv00.net's application manager:**
   Configure it to run `node dist/index.js` with auto-restart enabled.

6. **Setup Domain & SSL**
   Configure your domain and SSL certificate in the serv00.net control panel.

7. **First Login**
   Access your site and go to `/nimda`
   Login with: `admin` / `admin123`
   **CHANGE THIS PASSWORD IMMEDIATELY!**

## Troubleshooting

- Check serv00.net logs for errors
- Verify environment variables
- Make sure PostgreSQL is running
- Test outbound connections to letsembed.cc
EOL

echo -e "${GREEN}Deployment package created in the '${DEPLOY_DIR}' directory${NC}"

# Create compressed archive
echo -e "\n${YELLOW}Creating compressed archive for easy upload...${NC}"
tar -czf sill-deploy.tar.gz -C "$DEPLOY_DIR" .
echo -e "${GREEN}Archive created: sill-deploy.tar.gz${NC}"

echo -e "\n${GREEN}Deployment preparation complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Upload the contents of the '$DEPLOY_DIR' directory to serv00.net"
echo -e "2. Or upload 'sill-deploy.tar.gz' and extract it on the server"
echo -e "3. Follow the instructions in README.md to complete deployment"
echo -e "\n${GREEN}Thank you for using Sill! (https://github.com/sandy2k25/sill)${NC}"