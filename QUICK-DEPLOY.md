# Quick Deployment Guide for Ubuntu 20.04

This is a simplified guide with commands you can copy and paste for manually deploying Sill on Ubuntu 20.04.

## 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

## 2. Install Required Software

```bash
# Add NodeJS repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install NodeJS and dependencies
sudo apt install -y nodejs git build-essential libpangocairo-1.0-0 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libgconf-2-4 libasound2 libatk1.0-0 libgtk-3-0 nginx

# Install PM2 globally
sudo npm install -g pm2
```

## 3. Clone the Repository

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/sandy2k25/sill.git
cd sill
```

## 4. Install Dependencies and Build

```bash
sudo npm ci
sudo npm run build
```

## 5. Create Environment File

```bash
sudo nano .env
```

Add the following content (replace with your actual values):

```
NODE_ENV=production
PORT=5000
USE_WEBHOOK=true
VPS=true

# Admin password for web interface (change this)
ADMIN_PASSWORD=your_secure_password

# Telegram configuration (required)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id
TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_admin_password

# Domain for webhook mode (if you have a domain)
PUBLIC_URL=https://your-domain.com

# Database URL (optional - only if using PostgreSQL)
# DATABASE_URL=postgresql://username:password@localhost:5432/database
```

## 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/sill
```

Add the following content (replace yourdomain.com with your actual domain or leave as is for IP-only):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Or leave this line out for IP only

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 7. Start the Application with PM2

```bash
cd /var/www/sill
sudo pm2 start npm --name "sill" -- start
sudo pm2 save
sudo pm2 startup
# Run the command that PM2 outputs
sudo pm2 save
```

## 8. Set Up SSL (Optional - If You Have a Domain)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 9. Configure Firewall (Optional)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 10. Access the Application

- Web Interface: http://your-server-ip or https://yourdomain.com
- Admin Panel: http://your-server-ip/nimda or https://yourdomain.com/nimda
  - Username: `admin`
  - Password: The one you set in ADMIN_PASSWORD

## 11. Telegram Bot Authentication

1. Find your bot on Telegram
2. Send the command: `/admin your_password` 
   (Replace "your_password" with your TELEGRAM_BOT_ADMIN_PASSWORD)
3. After successful authentication, you'll see: "✅ You are now authorized as admin."

## 12. Common Commands

```bash
# View logs
sudo pm2 logs sill

# Restart application
sudo pm2 restart sill

# View application status
sudo pm2 status

# Stop application
sudo pm2 stop sill

# Update application
cd /var/www/sill
sudo git pull
sudo npm ci
sudo npm run build
sudo pm2 restart sill
```