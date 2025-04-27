#!/bin/bash

# Sill Easy Deployment Script for Android Users
# This script provides a simple deployment solution for users on Android devices

# Text formatting
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "  _____ _ _ _ "
echo " / ____(_) | |"
echo "| (___  _| | |"
echo " \___ \| | | |"
echo " ____) | | | |"
echo "|_____/|_|_|_|"
echo -e "${NC}"
echo "===== Android Deployment Script ====="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script with sudo privileges${NC}"
  echo -e "Try: ${YELLOW}sudo bash android-deploy.sh${NC}"
  exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# Ask for configuration
echo -e "${YELLOW}Enter your Telegram Bot Token:${NC}"
read -r TELEGRAM_BOT_TOKEN
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo -e "${RED}Telegram Bot Token is required. Exiting.${NC}"
  exit 1
fi

echo -e "${YELLOW}Enter your Telegram Channel ID:${NC}"
read -r TELEGRAM_CHAT_ID
if [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo -e "${RED}Telegram Channel ID is required. Exiting.${NC}"
  exit 1
fi

echo -e "${YELLOW}Enter admin username (default: admin):${NC}"
read -r ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

echo -e "${YELLOW}Enter admin password:${NC}"
read -r ADMIN_PASSWORD
if [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${RED}Admin password is required. Exiting.${NC}"
  exit 1
fi

# Generate a random JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo -e "\n${GREEN}Starting deployment...${NC}\n"

# Update system
echo -e "${BLUE}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js
echo -e "${BLUE}Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
apt install -y git curl nginx

# Install PM2
echo -e "${BLUE}Installing PM2...${NC}"
npm install -g pm2

# Set up app directory
echo -e "${BLUE}Setting up application directory...${NC}"
mkdir -p /var/www
cd /var/www || exit

# Clone repository
echo -e "${BLUE}Cloning Sill repository...${NC}"
if [ -d "sill" ]; then
  echo "Directory exists, pulling latest changes..."
  cd sill || exit
  git pull
else
  git clone https://github.com/sandy2k25/sill.git
  cd sill || exit
fi

# Install npm dependencies
echo -e "${BLUE}Installing Node.js dependencies...${NC}"
npm install

# Create environment file
echo -e "${BLUE}Creating environment file...${NC}"
cat > .env << EOL
NODE_ENV=production
PORT=5000
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOL

# Create Nginx configuration
echo -e "${BLUE}Setting up Nginx web server...${NC}"
cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL

# Enable the site
ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Start application with PM2
echo -e "${BLUE}Starting application with PM2...${NC}"
cd /var/www/sill || exit
pm2 start npm --name "sill" -- start

# Configure PM2 to start on boot
echo -e "${BLUE}Setting up PM2 to run on startup...${NC}"
pm2_startup=$(pm2 startup | grep -m 1 'sudo' || echo "")
if [ -n "$pm2_startup" ]; then
  eval "$pm2_startup"
  pm2 save
else
  echo -e "${YELLOW}PM2 startup command not found. You may need to run 'pm2 startup' manually.${NC}"
fi

# Set up firewall
echo -e "${BLUE}Setting up firewall...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow ssh
  ufw allow http
  ufw allow https
  ufw status | grep -q "Status: active" || ufw --force enable
else
  apt install -y ufw
  ufw allow ssh
  ufw allow http
  ufw allow https
  ufw --force enable
fi

# Display completion message
echo -e "\n${GREEN}===============================================${NC}"
echo -e "${GREEN}Sill has been successfully deployed!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo -e "\nYour application is available at: ${BLUE}http://$SERVER_IP${NC}"
echo -e "Admin username: ${BLUE}$ADMIN_USERNAME${NC}"

echo -e "\nHelpful PM2 commands:"
echo -e "  ${YELLOW}pm2 list${NC} - Show running processes"
echo -e "  ${YELLOW}pm2 logs sill${NC} - View application logs"
echo -e "  ${YELLOW}pm2 restart sill${NC} - Restart the application"
echo -e "  ${YELLOW}pm2 monit${NC} - Monitor CPU/Memory usage"

echo -e "\nEdit your config anytime with: ${YELLOW}nano /var/www/sill/.env${NC}"
echo -e "\n${GREEN}===============================================${NC}"