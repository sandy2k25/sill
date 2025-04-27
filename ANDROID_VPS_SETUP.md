# Easy VPS Setup from Android

Since you're working from an Android device, here's a super simple approach to deploy your app from the GitHub repository.

## Option 1: One-Command PM2 Setup

Copy and paste this single command into your VPS terminal:

```bash
curl -s https://raw.githubusercontent.com/sandy2k25/sill/main/android-deploy.sh | bash
```

## Option 2: Direct Install Commands

If you don't want to use the script, here's a set of commands you can copy and paste directly into your VPS:

```bash
# Install required packages
sudo apt update
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Get the code
cd /var/www || mkdir -p /var/www && cd /var/www
git clone https://github.com/sandy2k25/sill.git
cd sill
npm install

# Create a simple .env file - EDIT THESE VALUES!
cat > .env << 'EOL'
NODE_ENV=production
PORT=5000
JWT_SECRET=change-this-to-a-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
EOL

# Set up nginx
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
    }
}
EOL'

# Enable site and start nginx
sudo ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Start with PM2
pm2 start npm --name "sill" -- start
pm2 startup
# Copy and run the command PM2 shows you
pm2 save

echo "Done! Your app should be running at http://$(hostname -I | awk '{print $1}')"
```

## Need to Edit the .env File?

After running either option, you'll likely need to edit the `.env` file to add your actual credentials:

```bash
nano /var/www/sill/.env
```

After editing, restart the app:

```bash
pm2 restart sill
```

## Common PM2 Commands

```bash
# View status
pm2 list

# View logs
pm2 logs sill

# Restart the app
pm2 restart sill

# Monitor CPU/Memory usage
pm2 monit
```

## Enable SSL (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```