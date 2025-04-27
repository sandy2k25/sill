# Sill VPS Deployment with PM2

This guide shows how to deploy Sill on a VPS using PM2 for more robust process management.

## Why PM2?

PM2 offers several advantages:
- Easy start/stop/restart commands
- Automatic restart if the app crashes
- Built-in load balancing
- Process monitoring dashboard
- Simple log management
- No need for systemd configuration

## Quick PM2 Setup (Easiest Method)

Run this single command to set up everything with PM2:

```bash
curl -s https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill-pm2.sh | bash
```

## Manual PM2 Setup

### 1. Basic Setup

```bash
# Update system and install basics
sudo apt update
sudo apt install -y git curl nginx

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone the repository
mkdir -p /var/www
cd /var/www
git clone https://github.com/sandy2k25/sill.git
cd sill
npm install
```

### 2. Configure Environment

```bash
# Create .env file
cat > .env << EOL
NODE_ENV=production
PORT=5000
JWT_SECRET=your-random-jwt-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-channel-id
EOL
```

### 3. Setup Nginx

```bash
# Create Nginx config
sudo bash -c 'cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name your-domain-or-ip;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL'

# Enable site
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### 4. Start with PM2

```bash
# Start the application with PM2
pm2 start npm --name "sill" -- start

# Make PM2 auto-start at system boot
pm2 startup
```

Copy and paste the command PM2 gives you after running `pm2 startup`.

```bash
# Save the current PM2 configuration
pm2 save
```

## PM2 Commands Cheatsheet

```bash
# View all running processes
pm2 list

# Monitor CPU/Memory usage
pm2 monit

# View logs
pm2 logs sill

# View only error logs
pm2 logs sill --err

# Restart the application
pm2 restart sill

# Stop the application
pm2 stop sill

# Start the application
pm2 start sill

# Delete the application from PM2
pm2 delete sill
```

## Scale Your Application (Optional)

PM2 can run multiple instances of your app to utilize all CPU cores:

```bash
# Run as many instances as CPU cores
pm2 start npm --name "sill" -i max -- start

# Or specify a number of instances
pm2 start npm --name "sill" -i 2 -- start
```

## Updating Your Application

```bash
# Go to the app directory
cd /var/www/sill

# Pull the latest changes
git pull

# Install any new dependencies
npm install

# Restart the app with PM2
pm2 restart sill
```

## SSL Setup (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Follow the prompts to complete the setup.

## Troubleshooting

- **App not starting**: Check logs with `pm2 logs sill`
- **Error 502 Bad Gateway**: Make sure your app is running with `pm2 list` and listening on the correct port
- **Memory issues**: Monitor with `pm2 monit` and increase memory limit if needed with `pm2 start npm --name "sill" --max-memory-restart 300M -- start`