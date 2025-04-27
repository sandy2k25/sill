# VPS Deployment for Sill

This document explains how to deploy the Sill application on a Virtual Private Server (VPS).

## Quick Start

For quick deployment, you can use the automated deployment script:

```bash
# Download the deployment script
wget https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill-vps.sh

# Edit script to set your domain and database password
nano deploy-sill-vps.sh

# Make script executable
chmod +x deploy-sill-vps.sh

# Run the script with sudo
sudo ./deploy-sill-vps.sh
```

The script will:
1. Update your system
2. Install Node.js, PostgreSQL, Nginx, Git, and PM2
3. Set up a PostgreSQL database
4. Clone the Sill repository
5. Build the application
6. Configure Nginx as a reverse proxy
7. Set up SSL (if a valid domain is provided)
8. Configure the firewall

## Manual Deployment

If you prefer to deploy manually or want to understand the process better, follow these steps:

### System Requirements

- Ubuntu 20.04 or newer (recommended)
- Node.js 18.x or newer
- PostgreSQL 12 or newer
- Nginx
- Git
- PM2 (Node.js process manager)

### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL, Nginx, Git
sudo apt install -y postgresql postgresql-contrib nginx git

# Install PM2
sudo npm install -g pm2
```

### Step 2: Set Up Database

```bash
# Create database and user
sudo -u postgres psql -c "CREATE DATABASE silldb;"
sudo -u postgres psql -c "CREATE USER silluser WITH ENCRYPTED PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE silldb TO silluser;"
```

### Step 3: Deploy Application

```bash
# Create directory and set ownership
sudo mkdir -p /var/www/sill
sudo chown -R $USER:$USER /var/www/sill

# Clone repository
git clone https://github.com/sandy2k25/sill.git /var/www/sill
cd /var/www/sill

# Install dependencies
npm install

# Build the application
npm run build

# Create environment file
cat > .env << EOL
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://silluser:your_secure_password@localhost:5432/silldb
# Optional: Add Telegram configuration
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
EOL

# Initialize database
npx drizzle-kit push
```

### Step 4: Set Up PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOL
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

# Start the application
pm2 start ecosystem.config.js

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

### Step 5: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/sill
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Large file upload configuration
    client_max_body_size 20M;
}
```

Enable the configuration:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: Set Up SSL (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and configure SSL certificate
sudo certbot --nginx -d your-domain.com
```

### Step 7: Configure Firewall

```bash
# Allow SSH, HTTP and HTTPS
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Enable firewall
sudo ufw enable
```

## First Login

1. Access your application at your domain
2. Go to the admin area: `yourdomain.com/nimda`
3. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
4. **IMPORTANT**: Change the default password immediately!

## Updating the Application

To update Sill to the latest version:

```bash
# Go to the application directory
cd /var/www/sill

# Pull latest changes
git pull

# Install dependencies & rebuild
npm install
npm run build

# Restart the application
pm2 restart sill
```

## Monitoring and Logs

```bash
# Check application status
pm2 status

# View application logs
pm2 logs sill

# View Nginx access logs
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Application Won't Start

Check PM2 logs for errors:
```bash
pm2 logs sill
```

Verify the DATABASE_URL in the .env file is correct.

### Database Connection Issues

Test database connection:
```bash
psql -U silluser -h localhost silldb
```

### Nginx Configuration Issues

Check Nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

## Security Recommendations

1. Change the default admin password immediately
2. Set up regular database backups
3. Keep the system updated: `sudo apt update && sudo apt upgrade -y`
4. Install and configure fail2ban: `sudo apt install -y fail2ban`
5. Consider setting up a stronger firewall configuration

## Need Help?

If you encounter issues, please open an issue on the GitHub repository:
https://github.com/sandy2k25/sill/issues