# Hosting WovIeX on serv00.com

This guide provides specific instructions for deploying the WovIeX video scraper application on serv00.com hosting.

## Pre-Deployment Checklist

Before deploying, confirm that your serv00.com hosting plan includes:

- [ ] Node.js support (v18+ recommended)
- [ ] PostgreSQL database
- [ ] Ability to set environment variables
- [ ] SSH access (for running commands)
- [ ] Support for persistent applications/daemons

## Deployment Steps

### 1. Prepare Your Application

```bash
# On your local machine
npm run build
```

### 2. Configure serv00.com Server

1. **Log into your serv00.com control panel**
2. **Create a PostgreSQL database**:
   - Navigate to Databases section
   - Create a new PostgreSQL database
   - Note the connection credentials (host, port, username, password, database name)

3. **Configure Node.js**:
   - If serv00.com offers Node.js version selection, choose v18.x or v20.x

### 3. Upload Files

Upload the following files to your serv00.com hosting:

- `dist/` directory (contains compiled application)
- `package.json` file
- `player_template_simple.html` file (used for video player)
- `node_modules/` directory (or install dependencies on the server)

You can use SFTP, SCP, or the file manager in the serv00.com control panel.

### 4. Set Up Environment Variables

In the serv00.com control panel, set the following environment variables:

```
NODE_ENV=production
PORT=5000 (or the port specified by serv00.com)
DATABASE_URL=postgresql://username:password@hostname:port/database
TELEGRAM_BOT_TOKEN=your_bot_token (optional)
TELEGRAM_CHANNEL_ID=your_channel_id (optional)
```

### 5. Initialize Database

Connect to your server via SSH and run:

```bash
cd /path/to/your/application
npx drizzle-kit push
```

This will create all necessary database tables according to your schema.

### 6. Start the Application

#### Using PM2 (recommended if available):

```bash
# Install PM2 if not available
npm install -g pm2

# Start application with PM2
pm2 start dist/index.js --name wovie-scraper

# Make it restart on server reboot
pm2 startup
pm2 save
```

#### Using serv00.com's Application Manager:

If serv00.com provides an application manager or daemon configuration:

1. Set the start command to `node dist/index.js`
2. Configure it to auto-restart on failure
3. Ensure it starts on server reboot

### 7. Configure Domain and HTTPS

1. In the serv00.com control panel, set up your domain
2. Configure HTTPS (using Let's Encrypt or the SSL certificates provided by serv00.com)
3. Set up URL forwarding or reverse proxy if needed:

If serv00.com uses Apache, create an `.htaccess` file:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ http://localhost:5000/ [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://localhost:5000/$1 [P,L]
</IfModule>
```

If serv00.com uses Nginx, request this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## serv00.com-Specific Considerations

### Resource Limits

WovIeX can be resource-intensive during video scraping and streaming. Adjust these settings based on your plan:

1. If using PM2, set memory limits:
   ```
   pm2 start dist/index.js --name wovie-scraper --max-memory-restart=500M
   ```

2. In `server/scraper.ts`, you may need to adjust the cache TTL if storage is limited:
   ```typescript
   this.settings = {
     cacheEnabled: true,
     cacheTTL: 3600, // Adjust based on storage capacity
   };
   ```

### Puppeteer/Chromium Issues

The application is designed to fall back to HTTP scraping on restricted environments.
If serv00.com doesn't allow Puppeteer/Chromium:

1. Make sure this line in `server/index.ts` is present:
   ```typescript
   process.env.REPLIT_ENVIRONMENT = "true";
   ```
   This forces the HTTP fallback mode.

### Firewall Considerations

Make sure serv00.com allows:
1. Outbound connections to `letsembed.cc` (for scraping)
2. Outbound connections to `api.telegram.org` (if using Telegram features)

## Troubleshooting

### Application Won't Start

1. Check serv00.com error logs
2. Verify Node.js version compatibility
3. Confirm all necessary files are uploaded
4. Ensure environment variables are set correctly

### Database Connection Issues

1. Verify PostgreSQL credentials
2. Check if PostgreSQL is running and accessible
3. Confirm your IP is allowed to access the database (if restricted)

### Video Streaming Problems

1. Ensure outbound connections are allowed
2. Check for any bandwidth limitations on your plan
3. Verify the streaming endpoint is accessible

## Maintenance

### Log Rotation

If serv00.com doesn't handle log rotation automatically:

1. Install a log rotation tool or use the built-in functionality
2. Consider implementing log cleanup in your application:
   ```javascript
   // Add to server/routes.ts in an admin endpoint
   app.post('/api/logs/cleanup', authMiddleware, async (req, res) => {
     await storage.clearLogs();
     return res.json({ success: true });
   });
   ```

### Regular Updates

To update your application on serv00.com:

1. Build locally: `npm run build`
2. Upload new files to the server
3. Restart the application:
   - If using PM2: `pm2 restart wovie-scraper`
   - Otherwise use serv00.com's control panel

## Support

If you encounter issues specific to serv00.com hosting:

1. Contact serv00.com support for help with server configuration
2. Check if your hosting plan supports all required features
3. Consider upgrading your plan if resource limits are causing issues