# Android-Friendly VPS Commands (No Files Needed)

Since editing files directly on a VPS can be challenging from an Android device, here's a collection of copy-paste commands you can use to set up Sill without needing to create or edit files on the server.

## 1. One-Command PM2 Setup

Copy this entire command, paste it in your VPS terminal, and follow the prompts:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sandy2k25/sill/main/android-deploy.sh)"
```

## 2. Step-by-Step Commands (If the script doesn't work)

### Basic setup

```bash
# Update and install basics
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### Clone the repository

```bash
# Get the code
mkdir -p /var/www && cd /var/www
git clone https://github.com/sandy2k25/sill.git
cd sill
npm install
```

### Create environment file

Replace the values in < > brackets with your actual values:

```bash
# Create .env file
cat > .env << EOL
NODE_ENV=production
PORT=5000
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-secure-password>
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
TELEGRAM_CHAT_ID=<your-telegram-channel-id>
EOL
```

### Set up Nginx

```bash
# Create and enable Nginx config
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

sudo ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### Start with PM2

```bash
# Start with PM2
cd /var/www/sill
pm2 start npm --name "sill" -- start
pm2 startup
```

Copy and run the command that PM2 gives you, then:

```bash
pm2 save
```

## 3. Useful PM2 Commands

Copy and paste as needed:

```bash
# View running processes
pm2 list

# View logs 
pm2 logs sill

# Restart the app
pm2 restart sill

# Monitor resources
pm2 monit
```

## 4. Update Your Application

```bash
cd /var/www/sill
git pull
npm install
pm2 restart sill
```

## 5. Add SSL (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 6. Quick Fixes

### If your app won't start:

```bash
# Check logs for errors
pm2 logs sill --lines 100

# Make sure environment is correct
cd /var/www/sill && cat .env
```

### If you need to update Telegram settings:

```bash
cd /var/www/sill

# Update just the Telegram settings (replace with your values)
sed -i 's/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=your-new-token/' .env
sed -i 's/^TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=your-new-channel-id/' .env

# Restart to apply changes
pm2 restart sill
```