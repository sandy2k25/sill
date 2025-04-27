# Complete VPS Deployment Guide for WovIeX

This guide provides step-by-step instructions for deploying the WovIeX application on a VPS (Virtual Private Server) from scratch.

## Prerequisites

1. A VPS with Ubuntu 20.04 or newer
2. A domain name pointing to your VPS (optional but recommended)
3. Your Telegram bot token
4. A Telegram channel ID for storage

## Step 1: Initial Server Setup

### Connect to Your VPS

Use SSH to connect to your VPS:

```bash
ssh username@your-server-ip
```

### Update the System

```bash
sudo apt update
sudo apt upgrade -y
```

### Install Basic Requirements

```bash
sudo apt install -y git curl wget build-essential
```

## Step 2: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 8.x.x or higher
```

## Step 3: Clone the Repository

```bash
# Create a directory for the application
mkdir -p /var/www
cd /var/www

# Clone the repository (replace with your actual repository URL)
git clone https://github.com/yourusername/woviex.git
cd woviex
```

## Step 4: Install Dependencies

```bash
# Install npm dependencies
npm install
```

## Step 5: Configure Environment Variables

Create a `.env` file:

```bash
nano .env
```

Add the following environment variables:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=your-jwt-secret-key
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-admin-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 6: Create a Systemd Service

This will allow your application to run in the background and start automatically if the server restarts.

```bash
sudo nano /etc/systemd/system/woviex.service
```

Add the following content:

```
[Unit]
Description=WovIeX Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/woviex
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Save and exit (Ctrl+X, then Y, then Enter).

Enable and start the service:

```bash
sudo systemctl enable woviex
sudo systemctl start woviex
```

Check if the service is running:

```bash
sudo systemctl status woviex
```

## Step 7: Set Up Nginx as a Reverse Proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create an Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/woviex
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or server IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/woviex /etc/nginx/sites-enabled/
sudo nginx -t  # Test the configuration
sudo systemctl restart nginx
```

## Step 8: Set Up SSL with Let's Encrypt (Optional but Recommended)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain an SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts to complete the setup.

## Step 9: Testing Your Deployment

Visit your domain or server IP in a web browser. You should see the WovIeX application.

To check the API, visit:

```
https://your-domain.com/api/status
```

## Step 10: Troubleshooting

### Check Application Logs

```bash
sudo journalctl -u woviex
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
sudo systemctl restart woviex
sudo systemctl restart nginx
```

## Step 11: Creating a Deployment Script (Optional)

For easier future deployments, create a deployment script:

```bash
nano /var/www/woviex/deploy.sh
```

Add the following content:

```bash
#!/bin/bash

# Change to the application directory
cd /var/www/woviex

# Pull the latest changes
git pull

# Install dependencies
npm install

# Build the application (if needed)
npm run build

# Restart the service
sudo systemctl restart woviex

echo "Deployment completed successfully!"
```

Make the script executable:

```bash
chmod +x deploy.sh
```

Now you can run `./deploy.sh` to update your application.

## Step 12: Setting Up Regular Backups (Recommended)

Create a backup script:

```bash
nano /var/www/woviex/backup.sh
```

Add the following content:

```bash
#!/bin/bash

# Create backup directory if it doesn't exist
mkdir -p /var/www/backups

# Create a timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# Create a backup archive
tar -czf /var/www/backups/woviex-$TIMESTAMP.tar.gz -C /var/www woviex

echo "Backup created at /var/www/backups/woviex-$TIMESTAMP.tar.gz"
```

Make the script executable:

```bash
chmod +x backup.sh
```

Set up a cron job to run the backup daily:

```bash
sudo crontab -e
```

Add the following line:

```
0 2 * * * /var/www/woviex/backup.sh >/dev/null 2>&1
```

This will run the backup script every day at 2:00 AM.

## Important Notes for Telegram Storage

Since WovIeX uses Telegram for data storage, keep the following in mind:

1. Make sure your Telegram bot has admin privileges in the storage channel
2. The bot should have the ability to send messages to the channel
3. Regularly monitor the channel to ensure data is being saved properly
4. Consider setting up a second backup bot/channel for redundancy
5. Be aware of Telegram's rate limits (avoid sending too many messages too quickly)

## Security Recommendations

1. Set up a firewall:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```

2. Set up automatic security updates:
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

3. Consider setting up fail2ban to protect against brute force attacks:
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

4. Regularly update your system:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

## Monitoring Your VPS

Consider setting up basic monitoring:

```bash
sudo apt install -y htop
```

You can then monitor system resources by running `htop`.

For more advanced monitoring, consider setting up tools like Netdata or Prometheus.

## Conclusion

Your WovIeX application should now be running on your VPS. If you encounter any issues, check the logs and make sure all services are running correctly.

For further assistance, please refer to the application documentation or reach out to the development team.