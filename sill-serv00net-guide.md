# "Sill" Deployment Guide for serv00.net

This guide explains how to deploy the "Sill" project (https://github.com/sandy2k25/sill) on serv00.net hosting.

## Project Overview

Sill is a sophisticated web scraping application for extracting video URLs with admin and user interfaces. It provides video management through web and Telegram platforms with embed protection and enhanced video playback.

## Deployment Process

### 1. Clone the Repository

```bash
git clone https://github.com/sandy2k25/sill.git
cd sill
```

### 2. Prepare the Project

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Create a Deployment Package

Prepare a folder with these essential files:
- `dist/` (compiled application)
- `package.json`
- `player_template_simple.html`

### 4. serv00.net Configuration

#### 4.1 Create Database

1. Log in to your serv00.net control panel
2. Go to the Databases section
3. Create a new PostgreSQL database
4. Note your database credentials:
   - Database name
   - Username
   - Password
   - Host
   - Port

#### 4.2 Upload Files

1. Use FTP/SFTP to connect to your serv00.net account
2. Upload all the prepared files to your web directory
3. Set file permissions:
   - Directories: 755
   - Files: 644

#### 4.3 Configure Environment Variables

In the serv00.net control panel:

1. Locate the Environment Variables section
2. Add these variables:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
3. Optional: For Telegram features, add:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHANNEL_ID=your_telegram_channel_id
   ```

### 5. Initialize the Database

Connect to your serv00.net server via SSH:

```bash
# Navigate to your project directory
cd /path/to/your/sill

# Run database migrations
npx drizzle-kit push
```

### 6. Launch the Application

#### Option A: Using PM2 (Recommended)

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the application with PM2
pm2 start dist/index.js --name sill

# Make it restart automatically after server reboot
pm2 startup
pm2 save
```

#### Option B: Using serv00.net's Application Manager

1. In the serv00.net control panel, find the Node.js Applications section
2. Create a new application
3. Set the main file to `dist/index.js`
4. Configure it to restart automatically

### 7. Configure Domain and HTTPS

1. In the serv00.net control panel, go to Domains
2. Point your domain to the application
3. Enable SSL/HTTPS

### 8. First Login and Configuration

1. Access your site at your domain
2. Navigate to the admin area: `yourdomain.com/nimda`
3. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
4. **Important**: Change the default password immediately!
5. Configure whitelisted domains in the admin panel

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   - Check serv00.net logs for errors
   - Verify NODE_ENV and PORT are set correctly
   - Ensure all dependencies are installed

2. **Database Connection Issues**
   - Double-check your DATABASE_URL environment variable
   - Verify PostgreSQL is running
   - Test connection with a PostgreSQL client

3. **Video Scraping Problems**
   - Ensure outbound connections to letsembed.cc are allowed
   - Force HTTP fallback mode by setting `REPLIT_ENVIRONMENT=true`

4. **Telegram Bot Issues**
   - Verify your TELEGRAM_BOT_TOKEN is valid
   - Check if outbound connections to api.telegram.org are allowed

## Maintenance

1. **Updates**
   ```bash
   # Pull the latest changes
   git pull https://github.com/sandy2k25/sill.git

   # Rebuild the application
   npm run build

   # Restart the application
   pm2 restart sill
   ```

2. **Database Backup**
   ```bash
   # Create a backup of your database
   pg_dump -U username -h host database > backup.sql
   ```

3. **Log Management**
   - Use the admin interface to clear logs periodically
   - Set up log rotation if storing logs for a long time

## Additional Resources

- GitHub Repository: [https://github.com/sandy2k25/sill](https://github.com/sandy2k25/sill)
- Report Issues: [https://github.com/sandy2k25/sill/issues](https://github.com/sandy2k25/sill/issues)