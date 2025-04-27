# WovIeX Setup Guide for serv00.net

This is a simple guide for setting up the WovIeX video scraper application on serv00.net hosting.

## 1. Preparing Your Files

Build your application locally:

```bash
# Build the application
npm run build
```

Create a deployment folder with these essential files:
- `dist/` folder (contains your compiled code)
- `package.json`
- `player_template_simple.html`
- `node_modules/` (or you can install dependencies on the server)

## 2. Setting Up serv00.net

### Create an Account & Choose a Plan

1. Sign up at [serv00.net](https://serv00.net)
2. Select a plan with:
   - Node.js support
   - PostgreSQL database
   - At least 500MB storage space

### Set Up Your Database

1. Log in to your serv00.net control panel
2. Navigate to the Databases section
3. Create a new PostgreSQL database
4. Note down these details:
   - Database name
   - Username
   - Password
   - Host
   - Port

## 3. Uploading Your Files

1. Connect to your serv00.net account using FTP/SFTP
2. Upload all your prepared files to the web directory
3. Make sure file permissions are set correctly (755 for folders, 644 for files)

## 4. Setting Up Environment Variables

In your serv00.net control panel:

1. Look for "Environment Variables" or similar section
2. Set these variables:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
3. Optional: Add Telegram integration variables if needed
   ```
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHANNEL_ID=your_channel_id
   ```

## 5. Database Initialization

Connect to your server using SSH and run:

```bash
cd /path/to/your/files
npx drizzle-kit push
```

This will create all the required database tables.

## 6. Starting Your Application

### Option 1: Using PM2 (Recommended)

```bash
# Install PM2 if not available
npm install -g pm2

# Start your application
pm2 start dist/index.js --name wovie-scraper

# Make it restart automatically
pm2 startup
pm2 save
```

### Option 2: Using serv00.net Control Panel

1. Navigate to "Applications" or "Node.js" section
2. Create a new application
3. Set the entry point to `dist/index.js`
4. Enable auto-restart option

## 7. Setting Up Your Domain

1. In the serv00.net control panel, go to "Domains" section
2. Set up your domain to point to your application
3. Enable HTTPS/SSL for secure connections

## 8. Port Configuration

serv00.net may require specific port forwarding:

1. Check if port 5000 is accessible
2. If not, you have two options:
   - Configure application to use a different port
   - Set up a reverse proxy in the control panel

## 9. First Login

1. Access your site at your domain
2. Go to the admin area: `yourdomain.com/nimda`
3. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
4. **Important**: Change the default password immediately!

## 10. Testing Your Setup

1. Try adding a domain to the whitelist
2. Test video scraping with a test ID
3. Verify streaming works correctly

## Common Issues

### Application Won't Start

Check the serv00.net application logs for errors. Common issues:
- Incorrect environment variables
- Node.js version issues
- Missing dependencies

### Database Connection Problems

- Verify DATABASE_URL is correct
- Check if database server is running
- Confirm your IP is allowed to connect

### Video Streaming Issues

If videos don't play:
- Check if outbound connections are allowed
- Verify the streaming endpoint is accessible
- Confirm browser has proper codec support

## Support

If you encounter issues specific to serv00.net:
1. Check serv00.net documentation
2. Contact serv00.net support
3. Provide specific error messages from the logs

## Maintenance Tips

1. Regularly backup your database
2. Update the application when new versions are available
3. Monitor disk usage to avoid space issues
4. Clear logs periodically through the admin panel