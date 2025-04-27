# Super Simple VPS Setup Guide for Sill

This is an easy-to-follow guide with just the essential steps to get Sill running on your VPS quickly.

## 1. Connect to Your VPS

```bash
ssh username@your-server-ip
```

## 2. Run the One-Click Setup Script

Copy and paste this entire block at once to set up everything automatically:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl nodejs npm nginx

# Create app directory
mkdir -p /var/www
cd /var/www

# Clone the repository
git clone https://github.com/sandy2k25/sill.git
cd sill

# Install dependencies
npm install

# Create environment file
cat > .env << 'EOL'
NODE_ENV=production
PORT=5000
JWT_SECRET=change-this-to-a-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
EOL

# Set up Nginx
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

# Enable the site
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

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

# Start the service
sudo systemctl enable sill
sudo systemctl start sill

# Output success message
echo "========================================="
echo "Sill has been set up successfully!"
echo "Edit /var/www/sill/.env to set your actual credentials"
echo "View the application at: http://your-domain-or-ip"
echo "========================================="
```

## 3. Edit Your Configuration

After running the script above, edit your environment file with actual values:

```bash
sudo nano /var/www/sill/.env
```

Change these values:
- `JWT_SECRET`: Generate a random string
- `ADMIN_PASSWORD`: Set a secure password
- `TELEGRAM_BOT_TOKEN`: Your bot token from BotFather
- `TELEGRAM_CHAT_ID`: Your channel ID

## 4. Restart the Service

```bash
sudo systemctl restart sill
```

## 5. Add SSL (Optional but Recommended)

Run this to add HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

If something doesn't work:

1. Check logs:
   ```bash
   sudo journalctl -u sill --no-pager -n 100
   ```

2. Restart the app:
   ```bash
   sudo systemctl restart sill
   ```

3. Make sure ports are open:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```

## Common Commands

- Check app status: `sudo systemctl status sill`
- View logs: `sudo journalctl -u sill -f`
- Restart app: `sudo systemctl restart sill`
- Check web server status: `sudo systemctl status nginx`