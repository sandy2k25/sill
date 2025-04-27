#!/bin/bash
# Simple deployment script for serv00.net

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== WovIeX Deployment Script for serv00.net =====${NC}"
echo -e "This script will prepare your application for deployment"

# Step 1: Build the application
echo -e "\n${YELLOW}Step 1: Building the application...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed. Please fix the errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Step 2: Create deployment package
echo -e "\n${YELLOW}Step 2: Creating deployment package...${NC}"

# Create deployment directory
mkdir -p serv00net-deploy

# Copy built files
echo "Copying dist folder..."
cp -r dist serv00net-deploy/

# Copy essential files
echo "Copying essential files..."
cp package.json serv00net-deploy/
cp player_template_simple.html serv00net-deploy/

# Create start script
echo "Creating start script..."
cat > serv00net-deploy/start.sh << 'EOL'
#!/bin/bash
# Start script for serv00.net
export NODE_ENV=production
export PORT=5000
node dist/index.js
EOL
chmod +x serv00net-deploy/start.sh

# Create setup instructions
echo "Creating setup instructions..."
cat > serv00net-deploy/SETUP.md << 'EOL'
# serv00.net Setup Instructions

Follow these steps to deploy your application:

## 1. Upload Files
Upload all files in this directory to your serv00.net hosting account.

## 2. Install Dependencies
Connect to your server via SSH and run:
```
npm install
```

## 3. Set Up Database
Create a PostgreSQL database in your serv00.net control panel.

## 4. Set Environment Variables
In your serv00.net control panel, set these variables:
```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://username:password@host:port/database
```

## 5. Initialize Database
Run this command to set up the database tables:
```
npx drizzle-kit push
```

## 6. Start Application
Either use PM2:
```
npm install -g pm2
pm2 start dist/index.js --name wovie-scraper
pm2 startup
pm2 save
```

Or use the start script:
```
./start.sh
```

## 7. First Login
Access your site and go to /nimda
Login with: admin / admin123
CHANGE THIS PASSWORD IMMEDIATELY!
EOL

echo -e "${GREEN}Deployment package created in serv00net-deploy directory${NC}"
echo -e "${YELLOW}Upload these files to your serv00.net hosting account${NC}"
echo -e "${YELLOW}Follow the instructions in SETUP.md to complete deployment${NC}"

# Optional: Create compressed archive
echo -e "\n${YELLOW}Creating compressed archive for easy upload...${NC}"
tar -czf serv00net-deploy.tar.gz -C serv00net-deploy .
echo -e "${GREEN}Archive created: serv00net-deploy.tar.gz${NC}"

echo -e "\n${GREEN}Deployment preparation complete!${NC}"
echo -e "Upload either the serv00net-deploy directory contents or the tar.gz archive to your serv00.net hosting account."