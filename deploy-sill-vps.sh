#!/bin/bash
# Sill VPS Deployment Script
# For https://github.com/sandy2k25/sill
#
# This script automates the deployment of Sill on a VPS
# Run with sudo: sudo bash deploy-sill-vps.sh

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables (modify these)
APP_DIR="/var/www/sill"
DB_NAME="silldb"
DB_USER="silluser"
DB_PASSWORD="change_this_password"
DOMAIN="example.com" # Change to your domain, or use server IP

# Check if script is run with sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo${NC}"
  exit 1
fi

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}      Sill VPS Deployment Script${NC}"
echo -e "${BLUE}      https://github.com/sandy2k25/sill${NC}"
echo -e "${BLUE}===================================================${NC}"

# Step 1: Update system and install dependencies
echo -e "\n${YELLOW}Step 1: Updating system and installing dependencies...${NC}"
apt update && apt upgrade -y

# Install Node.js
echo -e "${YELLOW}Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
else
  echo -e "${GREEN}Node.js is already installed.${NC}"
fi

# Install PostgreSQL
echo -e "${YELLOW}Installing PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  apt install -y postgresql postgresql-contrib
else
  echo -e "${GREEN}PostgreSQL is already installed.${NC}"
fi

# Install Nginx
echo -e "${YELLOW}Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
  apt install -y nginx
else
  echo -e "${GREEN}Nginx is already installed.${NC}"
fi

# Install Git
echo -e "${YELLOW}Installing Git...${NC}"
if ! command -v git &> /dev/null; then
  apt install -y git
else
  echo -e "${GREEN}Git is already installed.${NC}"
fi

# Install PM2
echo -e "${YELLOW}Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
else
  echo -e "${GREEN}PM2 is already installed.${NC}"
fi

# Step 2: Set up PostgreSQL
echo -e "\n${YELLOW}Step 2: Setting up PostgreSQL...${NC}"

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo -e "${GREEN}Database $DB_NAME already exists.${NC}"
else
  echo -e "${YELLOW}Creating database $DB_NAME...${NC}"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
  echo -e "${YELLOW}Creating database user $DB_USER...${NC}"
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
  echo -e "${YELLOW}Granting privileges...${NC}"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
  echo -e "${GREEN}Database setup complete.${NC}"
fi

# Step 3: Clone and set up the Sill application
echo -e "\n${YELLOW}Step 3: Setting up Sill application...${NC}"

# Create application directory
mkdir -p $APP_DIR

# Check if repository already cloned
if [ -d "$APP_DIR/.git" ]; then
  echo -e "${GREEN}Git repository already exists. Pulling latest changes...${NC}"
  cd $APP_DIR
  git pull
else
  echo -e "${YELLOW}Cloning repository...${NC}"
  git clone https://github.com/sandy2k25/sill.git $APP_DIR
  cd $APP_DIR
fi

# Install dependencies and build
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}Building application...${NC}"
npm run build

# Create environment file
echo -e "${YELLOW}Creating environment configuration...${NC}"
cat > $APP_DIR/.env << EOL
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
# Uncomment and set these for Telegram integration
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
EOL

# Run database migrations
echo -e "${YELLOW}Initializing database...${NC}"
cd $APP_DIR
npx drizzle-kit push

# Create PM2 ecosystem file
echo -e "${YELLOW}Setting up PM2...${NC}"
cat > $APP_DIR/ecosystem.config.js << EOL
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

# Start the application with PM2
echo -e "${YELLOW}Starting application with PM2...${NC}"
cd $APP_DIR
pm2 start ecosystem.config.js

# Save PM2 configuration and set to start on boot
echo -e "${YELLOW}Setting PM2 to start on system boot...${NC}"
pm2 save
PM2_STARTUP_CMD=$(pm2 startup | grep -o 'sudo .*$')
eval $PM2_STARTUP_CMD

# Step 4: Configure Nginx
echo -e "\n${YELLOW}Step 4: Configuring Nginx...${NC}"

# Create Nginx configuration file
echo -e "${YELLOW}Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Large file upload configuration
    client_max_body_size 20M;
}
EOL

# Enable the Nginx configuration
echo -e "${YELLOW}Enabling Nginx configuration...${NC}"
ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# If Nginx test passes, restart Nginx
if [ $? -eq 0 ]; then
  echo -e "${YELLOW}Restarting Nginx...${NC}"
  systemctl restart nginx
else
  echo -e "${RED}Nginx configuration test failed. Please check the configuration.${NC}"
  exit 1
fi

# Step 5: Configure firewall
echo -e "\n${YELLOW}Step 5: Configuring firewall...${NC}"

if command -v ufw &> /dev/null; then
  echo -e "${YELLOW}Allowing SSH, HTTP, and HTTPS...${NC}"
  ufw allow ssh
  ufw allow http
  ufw allow https
  
  # Check if firewall is enabled
  if ! ufw status | grep -q "Status: active"; then
    echo -e "${YELLOW}Enabling firewall...${NC}"
    echo "y" | ufw enable
  fi
  echo -e "${GREEN}Firewall configured.${NC}"
else
  echo -e "${YELLOW}UFW not installed. Skipping firewall configuration.${NC}"
fi

# Step 6: Set up SSL with Let's Encrypt (if domain is provided)
if [[ "$DOMAIN" != "example.com" && "$DOMAIN" != $(hostname -I | awk '{print $1}') ]]; then
  echo -e "\n${YELLOW}Step 6: Setting up SSL with Let's Encrypt...${NC}"
  
  # Install Certbot
  echo -e "${YELLOW}Installing Certbot...${NC}"
  apt install -y certbot python3-certbot-nginx
  
  # Obtain and install SSL certificate
  echo -e "${YELLOW}Obtaining SSL certificate for $DOMAIN...${NC}"
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}SSL certificate installed successfully.${NC}"
  else
    echo -e "${RED}Failed to install SSL certificate. Check if the domain is properly configured.${NC}"
  fi
else
  echo -e "\n${YELLOW}Step 6: Skipping SSL setup (using example.com or IP address)${NC}"
  echo -e "${YELLOW}To set up SSL later, run: sudo certbot --nginx -d your-domain.com${NC}"
fi

# Final steps and instructions
echo -e "\n${GREEN}===================================================${NC}"
echo -e "${GREEN}Sill has been successfully deployed!${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e "\n${YELLOW}Access Information:${NC}"
echo -e "Application URL: http://$DOMAIN"
if [[ "$DOMAIN" != "example.com" && "$DOMAIN" != $(hostname -I | awk '{print $1}') ]]; then
  echo -e "Secure URL (SSL): https://$DOMAIN"
fi
echo -e "Admin Area: http://$DOMAIN/nimda"
echo -e "Default Login: admin / admin123"
echo -e "\n${RED}IMPORTANT: Change the default admin password immediately!${NC}"

echo -e "\n${YELLOW}Database Information:${NC}"
echo -e "Database Name: $DB_NAME"
echo -e "Database User: $DB_USER"
echo -e "Database Password: $DB_PASSWORD"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "View application logs: ${BLUE}pm2 logs sill${NC}"
echo -e "Restart application: ${BLUE}pm2 restart sill${NC}"
echo -e "View Nginx logs: ${BLUE}tail -f /var/log/nginx/access.log${NC}"
echo -e "Update application: ${BLUE}cd $APP_DIR && git pull && npm install && npm run build && pm2 restart sill${NC}"

echo -e "\n${GREEN}Deployment complete!${NC}"