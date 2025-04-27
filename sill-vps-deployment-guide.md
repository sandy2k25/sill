# Sill VPS Deployment Guide

This guide explains how to deploy the Sill project (https://github.com/sandy2k25/sill) on a Virtual Private Server (VPS).

## Prerequisites

- A VPS with SSH access (Ubuntu/Debian recommended)
- Root or sudo privileges
- Domain name pointing to your VPS (optional, but recommended)

## 1. Initial VPS Setup

### 1.1 Update System Packages

```bash
# Update package lists
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y
```

### 1.2 Install Required Dependencies

```bash
# Install Node.js (v18.x)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 8.x.x or higher

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 1.3 Secure PostgreSQL

```bash
# Set password for postgres user
sudo passwd postgres

# Switch to postgres user
su - postgres

# Create database and user for the application
psql -c "CREATE DATABASE silldb;"
psql -c "CREATE USER silluser WITH ENCRYPTED PASSWORD 'your_secure_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE silldb TO silluser;"

# Exit postgres user shell
exit
```

## 2. Deploy Sill Application

### 2.1 Clone Repository

```bash
# Create directory for the application
mkdir -p /var/www/sill
cd /var/www/sill

# Clone the repository
git clone https://github.com/sandy2k25/sill.git .
```

### 2.2 Install Dependencies & Build

```bash
# Install project dependencies
npm install

# Build the project
npm run build
```

### 2.3 Create Environment Configuration

```bash
# Create .env file
cat > .env << 'EOL'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://silluser:your_secure_password@localhost:5432/silldb
# Optional: Add Telegram configuration
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
EOL
```

### 2.4 Initialize Database

```bash
# Run database migrations
npx drizzle-kit push
```

### 2.5 Setup Application with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOL'
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

# Set PM2 to start on system boot
pm2 startup
pm2 save
```

## 3. Configure Nginx as Reverse Proxy

### 3.1 Create Nginx Configuration

```bash
# Create Nginx server block configuration
sudo nano /etc/nginx/sites-available/sill
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or server IP

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

### 3.2 Enable the Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 3.3 Set Up SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install SSL certificate
sudo certbot --nginx -d your-domain.com

# Follow the prompts to complete the setup
```

## 4. Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Enable firewall
sudo ufw enable
```

## 5. Initial Application Access

1. Access your application at your domain or server IP
2. Navigate to the admin area: `your-domain.com/nimda`
3. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
4. **Important**: Change the default password immediately!

## 6. Ongoing Maintenance

### 6.1 Application Updates

```bash
# Go to the application directory
cd /var/www/sill

# Pull latest changes
git pull

# Install dependencies (if package.json changed)
npm install

# Rebuild the application
npm run build

# Restart the application
pm2 restart sill
```

### 6.2 Database Backups

```bash
# Create backup directory
mkdir -p /var/backups/sill

# Create database backup
pg_dump -U silluser -h localhost silldb > /var/backups/sill/sill_db_$(date +%Y%m%d).sql

# Setup automated daily backups (optional)
cat > /etc/cron.daily/sill-backup << 'EOL'
#!/bin/bash
pg_dump -U silluser -h localhost silldb > /var/backups/sill/sill_db_$(date +%Y%m%d).sql
find /var/backups/sill/ -name "sill_db_*.sql" -mtime +7 -delete
EOL

chmod +x /etc/cron.daily/sill-backup
```

### 6.3 Log Management

```bash
# View PM2 logs
pm2 logs sill

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 7. Troubleshooting

### 7.1 Application Not Starting

Check PM2 logs:
```bash
pm2 logs sill
```

Verify the DATABASE_URL in .env is correct.

### 7.2 Database Connection Issues

Test database connection:
```bash
psql -U silluser -h localhost silldb
```

### 7.3 Nginx Configuration Issues

Check Nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

### 7.4 Telegram Bot Issues

Verify your TELEGRAM_BOT_TOKEN and ensure the bot has been created via BotFather.

## 8. Security Considerations

1. Set up regular system updates:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Configure database backup rotation to prevent disk space issues

3. Consider adding rate limiting to Nginx configuration:
   ```nginx
   # Add inside server block
   limit_req_zone $binary_remote_addr zone=sill:10m rate=10r/s;
   location / {
       limit_req zone=sill burst=20 nodelay;
       proxy_pass http://127.0.0.1:5000;
       # Other proxy settings...
   }
   ```

4. Install and configure fail2ban to prevent brute force attacks:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

## 9. Performance Optimization

1. Enable Nginx caching for static assets:
   ```nginx
   # Add inside http block in nginx.conf
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=STATIC:10m inactive=24h max_size=1g;
   
   # Add inside location block for static assets
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       proxy_pass http://127.0.0.1:5000;
       proxy_cache STATIC;
       proxy_cache_valid 200 1d;
       proxy_cache_use_stale error timeout invalid_header updating http_500 http_502 http_503 http_504;
       proxy_cache_lock on;
       expires 1d;
       add_header Cache-Control "public";
   }
   ```

2. Adjust PM2 settings for better performance (if needed):
   ```javascript
   // in ecosystem.config.js
   module.exports = {
     apps: [{
       name: "sill",
       script: "./dist/index.js",
       env: {
         NODE_ENV: "production",
         PORT: 5000
       },
       instances: "max", // Use all available CPUs
       exec_mode: "cluster", // Run in cluster mode
       autorestart: true,
       watch: false,
       max_memory_restart: "500M"
     }]
   };
   ```