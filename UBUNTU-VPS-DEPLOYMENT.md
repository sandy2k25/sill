# Sill - Ubuntu 20.04 VPS Deployment Guide

This guide provides step-by-step instructions for deploying the Sill application on an Ubuntu 20.04 VPS.

## Prerequisites

- Ubuntu 20.04 LTS VPS with at least 1GB RAM
- Root access or a user with sudo privileges
- A domain name pointed to your VPS (optional but recommended)
- PostgreSQL database (optional, application can use Telegram for storage)
- Telegram Bot Token (for Telegram integration)
- Telegram Channel ID (for storage via Telegram)

## 1. Initial Server Setup

### 1.1 Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Required Dependencies

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools and other dependencies
sudo apt install -y git build-essential libpangocairo-1.0-0 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libgconf-2-4 libasound2 libatk1.0-0 libgtk-3-0

# Install PostgreSQL (optional - if you want database storage)
sudo apt install -y postgresql postgresql-contrib

# Install PM2 for process management
sudo npm install -g pm2
```

### 1.3 Configure PostgreSQL (Optional)

Skip this step if you're using Telegram for storage.

```bash
# Create a new database user
sudo -u postgres createuser --interactive
# Enter name of role to add: sill
# Shall the new role be a superuser? (y/n): n
# Shall the new role be allowed to create databases? (y/n): y
# Shall the new role be allowed to create more new roles? (y/n): n

# Create a database
sudo -u postgres createdb sill

# Set a password for the user
sudo -u postgres psql
postgres=# ALTER USER sill WITH ENCRYPTED PASSWORD 'your_secure_password';
postgres=# \q

# Test the connection
psql -h localhost -U sill -d sill
# Enter password when prompted
# Type \q to exit
```

## 2. Deploy the Application

### 2.1 Clone the Repository

```bash
# Create a directory for the application
mkdir -p /var/www
cd /var/www

# Clone the repository
git clone https://github.com/sandy2k25/sill.git
cd sill
```

### 2.2 Install Dependencies

```bash
# Install npm dependencies
npm ci
```

### 2.3 Build the Application

```bash
# Build the application
npm run build
```

## 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following environment variables:

```
# Required environment variables
NODE_ENV=production
PORT=5000
USE_WEBHOOK=true
VPS=true

# Admin password for web interface (change this to a secure password)
ADMIN_PASSWORD=your_secure_admin_password

# Telegram configuration (required)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id
TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_admin_password

# For webhook mode (if your domain points to this server)
PUBLIC_URL=https://your-domain.com

# Database connection (optional - only if using PostgreSQL)
DATABASE_URL=postgresql://sill:your_secure_password@localhost:5432/sill
```

Save and close the file (Ctrl+X, then Y, then Enter).

## 4. Database Setup (If Using PostgreSQL)

Initialize the database with your schema:

```bash
npm run db:push
```

## 5. Configure Nginx as Reverse Proxy

### 5.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 5.2 Create an Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/sill
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain

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

Save and close the file.

### 5.3 Enable the Site and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5.4 Set Up SSL with Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts to complete the SSL setup.

## 6. Start the Application

### 6.1 Start with PM2

```bash
cd /var/www/sill
pm2 start npm --name "sill" -- start
pm2 save
```

### 6.2 Configure PM2 to Start on Boot

```bash
pm2 startup
# Run the command that PM2 outputs
pm2 save
```

## 7. Accessing the Application

- Web Interface: https://your-domain.com
- Admin Panel: https://your-domain.com/nimda
  - Default username: `admin`
  - Password: The one you set in the ADMIN_PASSWORD environment variable

## 8. Telegram Bot Setup

### 8.1 Telegram Bot Authentication

1. Find your bot on Telegram (using the username you set when creating the bot)
2. Send the command: `/admin your_password`
   (Replace "your_password" with the value you set for TELEGRAM_BOT_ADMIN_PASSWORD)
3. You should receive a confirmation: "✅ You are now authorized as admin."
4. You can now use commands like `/menu`, `/stats`, `/settings`, etc.

### 8.2 Available Telegram Bot Commands

After authenticating as admin, you can use these commands:

- `/menu` - Show the main menu
- `/stats` - Show system statistics
- `/settings` - Show/change settings
- `/domains` - Manage whitelisted domains
- `/cache` - Manage video cache
- `/logs` - View recent logs
- `/channel` - Configure channel storage
- `/help` - Show help information

## 9. Troubleshooting

### 9.1 Check Application Logs

```bash
pm2 logs sill
```

### 9.2 Restart the Application

```bash
pm2 restart sill
```

### 9.3 Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 9.4 Firewall Configuration

If you have UFW enabled, make sure to allow HTTP, HTTPS, and SSH:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

### 9.5 Common Issues and Solutions

#### Telegram Bot not working

- Verify the TELEGRAM_BOT_TOKEN is correct
- Ensure the bot has been added to the specified channel
- Check that the bot has admin permissions in the channel
- Use the correct format for TELEGRAM_CHANNEL_ID (should start with `-100`)

#### Application not starting

- Check if the build was successful
- Verify node_modules are installed
- Ensure the PORT environment variable matches the port in your Nginx configuration

## 10. Maintenance

### 10.1 Updating the Application

To update the application:

```bash
cd /var/www/sill
git pull
npm ci
npm run build
pm2 restart sill
```

### 10.2 Database Backups (If Using PostgreSQL)

```bash
pg_dump -U sill sill > backup_$(date +%Y%m%d).sql
```

### 10.3 Monitoring with PM2

```bash
pm2 monit
```

## 11. Security Recommendations

- Use strong passwords for all services
- Keep your server up to date with security patches
- Consider setting up a firewall (UFW)
- Disable password authentication for SSH and use key-based authentication
- Regularly backup your application data

## 12. Required Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| NODE_ENV | Sets the environment mode | production |
| PORT | Port for the application to listen on | 5000 |
| ADMIN_PASSWORD | Password for web admin interface | securepassword123 |
| TELEGRAM_BOT_TOKEN | Access token for your Telegram bot | 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11 |
| TELEGRAM_CHANNEL_ID | ID of Telegram channel for storage | -1001234567890 |
| TELEGRAM_BOT_ADMIN_PASSWORD | Password for Telegram bot admin commands | youradminpassword |
| DATABASE_URL | PostgreSQL connection string (optional) | postgresql://user:password@localhost:5432/dbname |
| PUBLIC_URL | Your domain for webhook mode | https://yourdomain.com |
| USE_WEBHOOK | Use webhook mode for Telegram | true |
| VPS | Indicates running on a VPS | true |