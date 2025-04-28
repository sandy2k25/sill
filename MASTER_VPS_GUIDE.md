# Complete Sill VPS Deployment Guide

This comprehensive guide covers everything you need to deploy Sill to a VPS, with options for both systemd and PM2 process management.

## Quick Start Options

### Option 1: One-Command Installation (PM2)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sandy2k25/sill/main/android-deploy.sh)"
```

### Option 2: One-Command Installation (systemd)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill.sh)"
```

## Detailed Step-by-Step Deployment

### Step 1: Update System & Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (skip if using systemd only)
sudo npm install -g pm2
```

### Step 2: Get the Application Code

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone repository
git clone https://github.com/sandy2k25/sill.git
cd sill

# Install dependencies
npm install

# Fix permissions to prevent 403 errors
sudo chown -R www-data:www-data /var/www/sill
sudo find /var/www/sill -type d -exec chmod 755 {} \;
sudo find /var/www/sill -type f -exec chmod 644 {} \;
sudo chmod 755 /var/www/sill/node_modules/.bin/*
```

### Step 3: Set Up Telegram Integration

Sill uses Telegram for data storage. You need:
- A Telegram bot token (get from @BotFather)
- A Telegram channel ID where data will be stored

```bash
# Create the environment file
cat > .env << EOL
NODE_ENV=production
PORT=5000
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-channel-id
EOL
```

### Step 4: Configure Nginx

```bash
# Create Nginx configuration
sudo bash -c 'cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $(hostname -I | awk "{print \$1}");

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
EOL'

# Enable the site
sudo ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### Step 5: Choose Process Manager

#### Option A: Use PM2 (Recommended)

```bash
# Start with PM2
cd /var/www/sill
pm2 start npm --name "sill" -- start

# Make PM2 start on boot
pm2 startup
# Run the command PM2 gives you
pm2 save
```

#### Option B: Use systemd

```bash
# Create service file
sudo bash -c 'cat > /etc/systemd/system/sill.service << EOL
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
EOL'

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable sill
sudo systemctl start sill
```

### Step 6: Set Up Firewall (Recommended)

```bash
sudo apt install -y ufw
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
```

### Step 7: Add SSL (Optional but Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain-name.com
```

## Managing Your Application

### PM2 Commands (if using PM2)

```bash
# Check running processes
pm2 list

# View logs
pm2 logs sill

# Monitor resources
pm2 monit

# Restart the app
pm2 restart sill

# Start the app
pm2 start sill

# Stop the app
pm2 stop sill
```

### systemd Commands (if using systemd)

```bash
# Check service status
sudo systemctl status sill

# View logs
sudo journalctl -u sill -f

# Restart the service
sudo systemctl restart sill

# Stop the service
sudo systemctl stop sill

# Start the service
sudo systemctl start sill
```

## Updating Your Application

```bash
# Go to app directory
cd /var/www/sill

# Pull latest changes
git pull

# Install any new dependencies
npm install

# Restart the app
# For PM2:
pm2 restart sill
# For systemd:
sudo systemctl restart sill
```

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs sill --lines 100

# Check systemd logs
sudo journalctl -u sill --no-pager -n 100

# Check .env file
cat /var/www/sill/.env
```

### Fixing 403 Forbidden Errors

If you get a "403 Forbidden" error or "You don't have permission to access" message:

```bash
# Fix file permissions
sudo chown -R www-data:www-data /var/www/sill
sudo find /var/www/sill -type d -exec chmod 755 {} \;
sudo find /var/www/sill -type f -exec chmod 644 {} \;
sudo chmod 755 /var/www/sill/node_modules/.bin/*

# Restart services
sudo systemctl restart nginx
# If using PM2:
pm2 restart sill
# If using systemd:
sudo systemctl restart sill
```

### Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -n 100 /var/log/nginx/error.log
```

### Telegram Integration Issues

If Telegram integration isn't working:

1. Verify your bot token with BotFather
2. Make sure the bot is an admin in your channel
3. For private channels, verify the channel ID (should start with -100)
4. Update your .env file with correct values and restart the app

## Complete Telegram Setup Guide

### Creating a Telegram Bot

1. Open Telegram and search for "BotFather" (@BotFather)
2. Start a chat and send `/newbot`
3. Follow instructions to create a new bot
4. Save the bot token you receive

### Creating a Channel for Data Storage

1. Create a new channel in Telegram
2. Add your bot as an administrator
3. Get the channel ID:
   - For public channels: `@your_channel_name`
   - For private channels: Forward a message to @getidsbot

### Testing Telegram Integration

After setting up and starting the app:
1. Access your Sill admin panel
2. Perform an action that saves data
3. Check your Telegram channel for JSON data messages
4. If messages appear, the integration is working correctly