#!/bin/bash

# Sill - Ubuntu 20.04 VPS Deployment Script
# This script automates the deployment of the Sill application on Ubuntu 20.04

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Sill - Ubuntu 20.04 Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo${NC}"
  exit 1
fi

# 1. Update system
echo -e "\n${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to update system packages. Please check your internet connection.${NC}"
  exit 1
fi
echo -e "${GREEN}System updated successfully.${NC}"

# 2. Install dependencies
echo -e "\n${YELLOW}Installing required dependencies...${NC}"
echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git build-essential libpangocairo-1.0-0 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libgconf-2-4 libasound2 libatk1.0-0 libgtk-3-0
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install required dependencies.${NC}"
  exit 1
fi

echo -e "${YELLOW}Installing PM2...${NC}"
npm install -g pm2
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install PM2.${NC}"
  exit 1
fi
echo -e "${GREEN}Dependencies installed successfully.${NC}"

# 3. Install Nginx
echo -e "\n${YELLOW}Installing and configuring Nginx...${NC}"
apt install -y nginx
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install Nginx.${NC}"
  exit 1
fi
echo -e "${GREEN}Nginx installed successfully.${NC}"

# 4. Clone repository
echo -e "\n${YELLOW}Cloning Sill repository...${NC}"
mkdir -p /var/www
cd /var/www
if [ -d "sill" ]; then
  echo -e "${YELLOW}Directory already exists. Updating...${NC}"
  cd sill
  git pull
else
  git clone https://github.com/sandy2k25/sill.git
  cd sill
fi
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to clone repository.${NC}"
  exit 1
fi
echo -e "${GREEN}Repository cloned successfully.${NC}"

# 5. Install application dependencies
echo -e "\n${YELLOW}Installing application dependencies...${NC}"
npm ci
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install application dependencies.${NC}"
  exit 1
fi
echo -e "${GREEN}Application dependencies installed successfully.${NC}"

# 6. Build application
echo -e "\n${YELLOW}Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build application.${NC}"
  exit 1
fi
echo -e "${GREEN}Application built successfully.${NC}"

# 7. Configure environment variables
echo -e "\n${YELLOW}Configuring environment variables...${NC}"
cat > .env << EOL
# Required environment variables
NODE_ENV=production
PORT=5000
USE_WEBHOOK=true
VPS=true

# Admin password for web interface (CHANGE THIS)
ADMIN_PASSWORD=admin123

# Telegram configuration (CHANGE THESE VALUES)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id
TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_admin_password

# For webhook mode (if your domain points to this server)
PUBLIC_URL=https://your-domain.com

# Database connection (optional - only if using PostgreSQL)
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
EOL
echo -e "${GREEN}Environment template created. ${YELLOW}IMPORTANT: Edit the .env file with your actual values before proceeding!${NC}"
echo -e "${YELLOW}Edit with: nano /var/www/sill/.env${NC}"

# 8. Configure Nginx
echo -e "\n${YELLOW}Configuring Nginx...${NC}"
read -p "Enter your domain name (e.g., yourdomain.com) or leave blank for IP only: " DOMAIN_NAME

# Create Nginx configuration
if [ -z "$DOMAIN_NAME" ]; then
  # IP-based configuration
  cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL
else
  # Domain-based configuration
  cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL
fi

# Enable the site
ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t
if [ $? -ne 0 ]; then
  echo -e "${RED}Nginx configuration test failed.${NC}"
  exit 1
fi

# Restart nginx
systemctl restart nginx
echo -e "${GREEN}Nginx configured successfully.${NC}"

# 9. Configure firewall
echo -e "\n${YELLOW}Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp  # SSH
  ufw allow 80/tcp  # HTTP
  ufw allow 443/tcp # HTTPS
  echo -e "${GREEN}Firewall configured.${NC}"
else
  echo -e "${YELLOW}UFW not installed. Skipping firewall configuration.${NC}"
fi

# 10. Start application with PM2
echo -e "\n${YELLOW}Starting application with PM2...${NC}"
cd /var/www/sill
pm2 start npm --name "sill" -- start
pm2 save
echo -e "${GREEN}Application started with PM2.${NC}"

# 11. Set up PM2 to start on boot
echo -e "\n${YELLOW}Setting up PM2 to start on boot...${NC}"
pm2 startup
PM2_STARTUP=$(pm2 startup | grep -o "sudo.*")
if [ ! -z "$PM2_STARTUP" ]; then
  $PM2_STARTUP
  pm2 save
  echo -e "${GREEN}PM2 startup configured successfully.${NC}"
else
  echo -e "${YELLOW}Could not configure PM2 startup automatically.${NC}"
  echo -e "${YELLOW}Run 'pm2 startup' and follow the instructions.${NC}"
fi

# 12. Set up SSL with Certbot (if domain provided)
if [ ! -z "$DOMAIN_NAME" ]; then
  echo -e "\n${YELLOW}Setting up SSL with Let's Encrypt...${NC}"
  apt install -y certbot python3-certbot-nginx
  
  echo -e "${YELLOW}Attempting to obtain SSL certificate...${NC}"
  certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME --redirect
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to obtain SSL certificate automatically.${NC}"
    echo -e "${YELLOW}You can try manually with: sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME${NC}"
  else
    echo -e "${GREEN}SSL certificate obtained successfully.${NC}"
  fi
else
  echo -e "\n${YELLOW}No domain provided, skipping SSL setup.${NC}"
  echo -e "${YELLOW}To set up SSL later, install certbot and run: sudo certbot --nginx${NC}"
fi

# 13. Final instructions
echo -e "\n${GREEN}==========================================${NC}"
echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "\n${YELLOW}IMPORTANT: Before using the application:${NC}"
echo -e "${YELLOW}1. Edit the .env file with your actual values:${NC}"
echo -e "   ${YELLOW}nano /var/www/sill/.env${NC}"
echo -e "${YELLOW}2. After updating the .env file, restart the application:${NC}"
echo -e "   ${YELLOW}pm2 restart sill${NC}"

if [ ! -z "$DOMAIN_NAME" ]; then
  echo -e "\n${GREEN}Your application is accessible at:${NC}"
  echo -e "- Web Interface: ${YELLOW}https://$DOMAIN_NAME${NC}"
  echo -e "- Admin Panel: ${YELLOW}https://$DOMAIN_NAME/nimda${NC}"
else
  echo -e "\n${GREEN}Your application is accessible at:${NC}"
  echo -e "- Web Interface: ${YELLOW}http://YOUR_SERVER_IP${NC}"
  echo -e "- Admin Panel: ${YELLOW}http://YOUR_SERVER_IP/nimda${NC}"
fi

echo -e "\n${GREEN}Default admin credentials:${NC}"
echo -e "- Username: ${YELLOW}admin${NC}"
echo -e "- Password: ${YELLOW}admin123${NC} (or the one you set in ADMIN_PASSWORD)"
echo -e "${RED}IMPORTANT: Change the default password immediately!${NC}"

echo -e "\n${GREEN}Telegram Bot Authentication:${NC}"
echo -e "1. Find your bot on Telegram"
echo -e "2. Send the command: ${YELLOW}/admin your_password${NC}"
echo -e "   (Replace \"your_password\" with your TELEGRAM_BOT_ADMIN_PASSWORD)"

echo -e "\n${GREEN}For more detailed instructions, read:${NC}"
echo -e "${YELLOW}/var/www/sill/UBUNTU-VPS-DEPLOYMENT.md${NC}"
echo -e "\n${GREEN}Thank you for using Sill!${NC}"