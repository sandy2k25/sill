#!/bin/bash

# Sill Easy Deployment Script
# This script automates the deployment of Sill on a VPS

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
echo "===== Easy Deployment Script ====="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script as root or with sudo${NC}"
  exit 1
fi

# Ask for configuration
echo -e "${YELLOW}Enter your domain or server IP (default: server IP):${NC}"
read -r DOMAIN
if [ -z "$DOMAIN" ]; then
  DOMAIN=$(hostname -I | awk '{print $1}')
  echo -e "Using server IP: ${BLUE}$DOMAIN${NC}"
fi

echo -e "${YELLOW}Enter your Telegram Bot Token:${NC}"
read -r TELEGRAM_BOT_TOKEN
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo -e "${RED}Telegram Bot Token is required.${NC}"
  exit 1
fi

echo -e "${YELLOW}Enter your Telegram Channel ID:${NC}"
read -r TELEGRAM_CHAT_ID
if [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo -e "${RED}Telegram Channel ID is required.${NC}"
  exit 1
fi

echo -e "${YELLOW}Enter admin username (default: admin):${NC}"
read -r ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

echo -e "${YELLOW}Enter admin password:${NC}"
read -r ADMIN_PASSWORD
if [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${RED}Admin password is required.${NC}"
  exit 1
fi

# Generate a random JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo -e "\n${GREEN}Starting deployment...${NC}\n"

# Update system
echo -e "${BLUE}Updating system...${NC}"
apt update && apt upgrade -y

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
apt install -y git curl nodejs npm nginx

# Create app directory
echo -e "${BLUE}Creating application directory...${NC}"
mkdir -p /var/www
cd /var/www || exit

# Clone repository
echo -e "${BLUE}Cloning repository...${NC}"
# Replace this URL with your actual repository URL
GIT_REPO="https://github.com/yourusername/sill.git"
if [ -d "sill" ]; then
  echo "Sill directory already exists. Updating..."
  cd sill || exit
  git pull
else
  git clone "$GIT_REPO" sill
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
echo -e "${BLUE}Setting up Nginx...${NC}"
cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $DOMAIN;

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

# Create systemd service
echo -e "${BLUE}Creating systemd service...${NC}"
cat > /etc/systemd/system/sill.service << EOL
[Unit]
Description=Sill Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/sill
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Enable and start the service
systemctl daemon-reload
systemctl enable sill
systemctl restart sill

# Set up firewall
echo -e "${BLUE}Setting up firewall...${NC}"
apt install -y ufw
ufw allow ssh
ufw allow http
ufw allow https
# Only enable if not already enabled (to avoid locking yourself out)
ufw status | grep -q "Status: active" || ufw --force enable

# Display completion message
echo -e "\n${GREEN}===============================================${NC}"
echo -e "${GREEN}Sill has been successfully deployed!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo -e "\nYour application is available at: ${BLUE}http://$DOMAIN${NC}"
echo -e "Admin username: ${BLUE}$ADMIN_USERNAME${NC}"
echo -e "\nTo view application logs: ${YELLOW}sudo journalctl -u sill -f${NC}"
echo -e "To restart the application: ${YELLOW}sudo systemctl restart sill${NC}"
echo -e "\nConsider setting up SSL with: ${YELLOW}sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN${NC}"
echo -e "\n${GREEN}===============================================${NC}"