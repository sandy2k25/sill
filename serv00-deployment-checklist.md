# serv00.com Deployment Checklist

Use this checklist to ensure a smooth deployment of your WovIeX application to serv00.com.

## Pre-Deployment

- [ ] Verify serv00.com hosting plan supports Node.js
- [ ] Confirm PostgreSQL database is available
- [ ] Check if PM2 or similar process manager is available
- [ ] Verify outbound connections are allowed (for video scraping)
- [ ] Check available storage (minimum 500MB recommended)
- [ ] Ensure sufficient bandwidth for video streaming

## Preparation

- [ ] Run `node prepare-serv00-package.js` to create optimized deployment package
- [ ] Review the generated files in the `serv00-deploy` directory
- [ ] Prepare database connection details:
  - Host: _________________
  - Port: _________________
  - Username: _________________
  - Password: _________________
  - Database name: _________________
- [ ] (Optional) Prepare Telegram bot token: _________________
- [ ] (Optional) Prepare Telegram channel ID: _________________

## Deployment

- [ ] Upload all files from the `serv00-deploy` directory to serv00.com
- [ ] Configure environment variables in serv00.com control panel:
  - [ ] NODE_ENV=production
  - [ ] PORT=5000 (or as required by serv00.com)
  - [ ] DATABASE_URL=postgresql://username:password@hostname:port/database
  - [ ] TELEGRAM_BOT_TOKEN (optional)
  - [ ] TELEGRAM_CHANNEL_ID (optional)
- [ ] Connect to serv00.com via SSH
- [ ] Run database migrations: `npx drizzle-kit push`
- [ ] Start the application:
  - Using start script: `./start.sh`
  - Using PM2: `pm2 start ecosystem.config.js`
  - Or via serv00.com's application manager

## Post-Deployment Verification

- [ ] Access the application in a web browser
- [ ] Log in to admin area (/nimda) using default credentials:
  - Username: `admin`
  - Password: `admin123`
- [ ] Change default admin password immediately
- [ ] Configure additional domains in whitelist
- [ ] Test video scraping functionality
- [ ] Test video streaming

## Troubleshooting Common Issues

### Application Won't Start
- [ ] Check serv00.com error logs
- [ ] Verify Node.js version compatibility
- [ ] Confirm all environment variables are set correctly

### Database Connection Issues
- [ ] Verify PostgreSQL credentials
- [ ] Check if PostgreSQL is running and accessible
- [ ] Try connecting to the database manually to test credentials

### Video Scraping Problems
- [ ] Verify outbound connections are allowed
- [ ] Check if `letsembed.cc` is accessible from serv00.com
- [ ] Force HTTP fallback mode by setting environment variable:
  `REPLIT_ENVIRONMENT=true`

### Video Streaming Issues
- [ ] Check if streaming endpoints are accessible
- [ ] Verify bandwidth limits on your hosting plan
- [ ] Test with different videos to isolate the issue

## Maintenance Plan

- [ ] Set up regular backups of your PostgreSQL database
- [ ] Implement log rotation or cleanup
- [ ] Plan for regular updates to the application
- [ ] Monitor disk space usage (particularly if caching is enabled)
- [ ] Set up uptime monitoring to detect outages