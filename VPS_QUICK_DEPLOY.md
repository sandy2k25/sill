# Sill VPS Quick Deploy Guide

## Option 1: One-Command Installation

Copy and paste this single command to your VPS terminal:

```bash
curl -s https://raw.githubusercontent.com/yourusername/sill/main/deploy-sill.sh | bash
```

You'll be asked for:
- Your domain name (or use server IP)
- Telegram bot token
- Telegram channel ID
- Admin username and password

## Option 2: Manual Deployment (4 Simple Steps)

### Step 1: Get the code
```bash
# Update system and install basics
sudo apt update
sudo apt install -y git curl nodejs npm

# Get the code
git clone https://github.com/yourusername/sill.git
cd sill
npm install
```

### Step 2: Configure
```bash
# Create/edit .env file
nano .env
```

Add these lines:
```
NODE_ENV=production
PORT=5000
JWT_SECRET=random-string-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-channel-id
```

### Step 3: Set up as a service
```bash
# Create service file
sudo bash -c 'cat > /etc/systemd/system/sill.service << EOL
[Unit]
Description=Sill Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory='$(pwd)'
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL'

# Start the service
sudo systemctl enable sill
sudo systemctl start sill
```

### Step 4: Set up web server
```bash
# Install nginx
sudo apt install -y nginx

# Create site config
sudo bash -c 'cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name '$(hostname -I | awk "{print \$1}")';

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOL'

# Enable site
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Visit your server IP in a browser to see your app!

## Common Commands

```bash
# Restart application
sudo systemctl restart sill

# View logs
sudo journalctl -u sill -f

# Update application
cd /path/to/sill
git pull
npm install
sudo systemctl restart sill
```