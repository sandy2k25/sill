# WovIeX Deployment Guide for Serv00.net (Shell Access Only)

This comprehensive guide provides step-by-step instructions for deploying WovIeX on Serv00.net using only shell access (without admin privileges).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Preparation](#preparation)
3. [Connecting to Serv00.net Shell](#connecting-to-serv00net-shell)
4. [Application Deployment](#application-deployment)
5. [Database Setup](#database-setup)
6. [Environment Configuration](#environment-configuration)
7. [Starting the Application](#starting-the-application)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

## Prerequisites

Before starting, ensure you have:

- Your Serv00.net account login details
- SSH access to your Serv00.net account
- Database credentials (provided by Serv00.net)
- Telegram Bot Token (if using Telegram features)
- Telegram Channel ID (if using Telegram storage)

## Preparation

1. **Generate Deployment Package**

   On your local machine, run the preparation script:

   ```bash
   node prepare-serv00-package.js
   ```

   This will create a `serv00-deploy` directory with all required files.

2. **Create a .tar.gz Archive**

   ```bash
   cd serv00-deploy
   tar -czf ../wovie-deploy.tar.gz .
   cd ..
   ```

   The archive will be more efficient to upload.

## Connecting to Serv00.net Shell

1. **Connect via SSH**

   ```bash
   ssh username@your-serv00-hostname
   ```

   Replace `username` and `your-serv00-hostname` with your Serv00.net credentials.

2. **Navigate to Web Directory**

   Serv00.net typically has a directory where your web files should be placed:

   ```bash
   cd ~/public_html
   # OR
   cd ~/www
   # OR (check your specific path)
   cd ~/htdocs
   ```

   Check the correct path with Serv00.net support if needed.

## Application Deployment

1. **Upload the Deployment Package**

   **Option 1: Using SCP** (from your local machine):

   ```bash
   scp wovie-deploy.tar.gz username@your-serv00-hostname:~/public_html/
   ```

   **Option 2: Using SFTP**:
   
   Use any SFTP client to upload the `.tar.gz` file to your web directory.

2. **Extract the Archive**

   On Serv00.net shell:

   ```bash
   cd ~/public_html
   # Create a specific directory for the application (recommended)
   mkdir -p wovie-app
   cd wovie-app
   # Extract the archive
   tar -xzf ../wovie-deploy.tar.gz
   # Remove the archive file (optional)
   rm ../wovie-deploy.tar.gz
   ```

3. **Install Node.js Dependencies**

   ```bash
   # Check if npm is installed
   which npm
   
   # If npm is not found, you'll need to use Serv00.net's Node.js version
   # This is typically available through their custom path or Node.js selector
   
   # Install dependencies
   npm ci --only=production
   ```

   If you included node_modules in your deployment package, this step might be optional.

## Database Setup

1. **Locate Your Database Credentials**

   Serv00.net will provide database credentials through their control panel. You need:
   - Database name
   - Username
   - Password
   - Host (usually localhost)
   - Port (usually 5432 for PostgreSQL)

2. **Configure Database Connection**

   Create a `.env` file:

   ```bash
   nano .env
   ```

   Add your database connection string:

   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@localhost:5432/databasename
   # Replace username, password, and databasename with your actual credentials
   ```

   Save with `CTRL+O` and exit with `CTRL+X`.

3. **Initialize Database Schema**

   ```bash
   # Run database migrations
   npx drizzle-kit push
   ```

## Environment Configuration

1. **Configure Telegram Integration (Optional)**

   If you're using Telegram features, add these to your `.env` file:

   ```bash
   nano .env
   ```

   Add:

   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHANNEL_ID=your_telegram_channel_id
   ADMIN_PASSWORD=your_secure_admin_password
   TELEGRAM_BOT_ADMIN_PASSWORD=your_secure_bot_admin_password
   ```

   Save with `CTRL+O` and exit with `CTRL+X`.

2. **Make Scripts Executable**

   ```bash
   chmod +x start.sh
   ```

## Starting the Application

Serv00.net has several methods to run Node.js applications, depending on what's available with your account:

### Option 1: Running in Background with nohup

```bash
nohup ./start.sh > app.log 2>&1 &
```

This runs the application in the background and logs output to `app.log`.

### Option 2: Using PM2 (if available)

```bash
# Check if PM2 is installed
which pm2

# If available, start with PM2
pm2 start ecosystem.config.js
```

### Option 3: Using Screen (if available)

```bash
# Check if screen is installed
which screen

# If available, use screen
screen -S wovie
./start.sh
```

To detach from the screen session, press `CTRL+A` then `D`. To reattach:

```bash
screen -r wovie
```

### Verify the Application is Running

```bash
# Check if the application is running on port 5000
netstat -tulpn | grep 5000

# Check the logs
tail -f app.log
```

## Accessing the Application

1. **Configure Web Access**

   Create a `.htaccess` file in your web root if not already created:

   ```bash
   nano ~/public_html/.htaccess
   ```

   Add content (if Serv00.net supports mod_proxy):

   ```
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteRule ^$ http://localhost:5000/ [P,L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule ^(.*)$ http://localhost:5000/$1 [P,L]
   </IfModule>
   ```

   Save with `CTRL+O` and exit with `CTRL+X`.

2. **First Login**

   - Access your site at: `https://your-serv00-domain.com`
   - Admin interface: `https://your-serv00-domain.com/nimda`
   - Default login: 
     - Username: `admin`
     - Password: `admin123` (or whatever you set in ADMIN_PASSWORD)
   - **Change the default password immediately!**

## Troubleshooting

### Common Issues and Solutions

1. **Application Won't Start**

   ```bash
   # Check application logs
   tail -f app.log
   
   # Verify Node.js version
   node -v
   
   # Check disk space
   df -h
   
   # Check memory usage
   free -m
   ```

2. **Database Connection Issues**

   ```bash
   # Verify PostgreSQL is accessible
   nc -zv localhost 5432
   
   # Check database credentials manually
   psql -h localhost -U username -d databasename -p 5432
   # You'll be prompted for the password
   ```

3. **Port Already in Use**

   ```bash
   # Find what's using port 5000
   netstat -tulpn | grep 5000
   
   # Kill the process if needed
   kill -9 PID
   # Replace PID with the process ID from the previous command
   ```

4. **Cannot Access Web Interface**

   - Check if the `.htaccess` file is correctly formatted
   - Verify the application is running (`netstat -tulpn | grep 5000`)
   - Check Serv00.net's domain configuration

### Log Files to Check

```bash
# Application logs
tail -f app.log

# Error logs (might be in Serv00.net's custom location)
tail -f ~/logs/error_log
```

## Maintenance

### Restarting the Application

```bash
# Find the process
ps aux | grep node

# Kill the process
kill -9 PID
# Replace PID with the process ID

# Start again
nohup ./start.sh > app.log 2>&1 &
```

### Updating the Application

1. Generate a new deployment package on your local machine
2. Upload and extract as in the initial deployment
3. Re-run database migrations if schema has changed
4. Restart the application

## Telegram Bot Integration

If you've configured the Telegram bot, you can:

1. Start the bot by sending `/start` to your bot on Telegram
2. Authenticate with `/admin YOUR_ADMIN_PASSWORD`
3. Use commands like `/stats`, `/settings`, `/domains`, `/cache`, `/logs`, and `/channel`

## Security Considerations

1. Change default passwords immediately
2. Use strong, unique passwords
3. Keep your application up to date
4. Check logs regularly for suspicious activity

---

## Quick Reference Commands

```bash
# Connect via SSH
ssh username@your-serv00-hostname

# Extract archive
tar -xzf wovie-deploy.tar.gz

# Install dependencies
npm ci --only=production

# Initialize database
npx drizzle-kit push

# Start application (background)
nohup ./start.sh > app.log 2>&1 &

# Check if running
netstat -tulpn | grep 5000

# View logs
tail -f app.log

# Restart application
kill -9 $(ps aux | grep node | grep -v grep | awk '{print $2}')
nohup ./start.sh > app.log 2>&1 &
```

---

_Last updated: April 2025_