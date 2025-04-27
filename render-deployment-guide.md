# Deploying Sill on Render.com

This guide explains how to deploy the Sill project (https://github.com/sandy2k25/sill) on Render.com's cloud platform.

## Why Render.com?

Render.com provides a modern cloud platform that automatically handles infrastructure, including SSL, a global CDN, DDoS protection, and auto-scaling. It's ideal for Node.js applications like Sill.

## Prerequisites

- A GitHub account with access to the Sill repository (https://github.com/sandy2k25/sill)
- A Render.com account (https://render.com)
- (Optional) A custom domain name

## Deployment Steps

### 1. Create a PostgreSQL Database

1. Log in to your Render.com dashboard
2. Navigate to **PostgreSQL** in the left sidebar
3. Click **New PostgreSQL** button
4. Configure your database:
   - **Name**: `sill-db` (or your preferred name)
   - **Database**: `silldb`
   - **User**: Leave default
   - **Region**: Choose the region closest to your users
   - **PostgreSQL Version**: 14 or higher
   - **Plan Type**: Select based on your needs (Start with Free tier for testing)
5. Click **Create Database**
6. After creation, note down:
   - Internal Database URL
   - External Database URL
   - Username and Password

### 2. Deploy the Web Service

1. From your Render dashboard, navigate to **Web Services**
2. Click **New Web Service**
3. Connect your GitHub repository (https://github.com/sandy2k25/sill)
4. Configure the service:
   - **Name**: `sill` (or your preferred name)
   - **Region**: Choose the same region as your database
   - **Branch**: `main` (or your preferred branch)
   - **Root Directory**: Leave empty
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Plan Type**: Select based on your needs (Start with Free tier for testing)

5. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render uses this port by default)
   - `DATABASE_URL`: Paste the Internal Database URL from the previous step
   - (Optional) `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - (Optional) `TELEGRAM_CHANNEL_ID`: Your Telegram channel ID

6. Under **Advanced** settings:
   - Configure **Health Check Path**: `/api/stats` (if available) or `/`
   - Set **Auto-Deploy**: According to your preference

7. Click **Create Web Service**

### 3. Initialize the Database

After deployment is complete, you'll need to initialize the database with the required tables. You can do this using Render's Shell feature:

1. From your Web Service dashboard, go to the **Shell** tab
2. Run the following command:
   ```bash
   npx drizzle-kit push
   ```

### 4. Configure Custom Domain (Optional)

1. From your Web Service dashboard, go to the **Settings** tab
2. Scroll to **Custom Domain**
3. Click **Add Custom Domain**
4. Enter your domain name and follow the instructions to configure DNS settings

### 5. First Login

1. Access your application at the Render URL or your custom domain
2. Navigate to the admin area: `yourdomain.com/nimda`
3. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
4. **IMPORTANT**: Change the default password immediately!

## Render.com-Specific Configuration

### Persistent Disk

If your application needs to store files that should persist between deployments:

1. Go to your Web Service's **Settings** tab
2. Scroll to **Disks**
3. Click **Add Disk**
4. Configure:
   - **Name**: `sill-data`
   - **Mount Path**: `/data`
   - **Size**: Choose based on needs (minimum 1GB)

Then update your application to save files to this path.

### Scaling

Render offers automatic scaling for higher-tier plans:

1. Go to your Web Service's **Settings** tab
2. Under **Scaling**, you can configure:
   - **Auto-Scale**: Toggle on/off
   - **Min Instances**: Minimum number of instances
   - **Max Instances**: Maximum number of instances

### Continuous Deployment

By default, Render will automatically deploy when you push to the connected GitHub repository. To change this:

1. Go to your Web Service's **Settings** tab
2. Find **Auto-Deploy** and select your preference:
   - **Yes**: Deploy on every push
   - **No**: Manual deploys only

## Troubleshooting

### Deployment Failures

1. Check the **Logs** tab in your Web Service dashboard
2. Common issues:
   - Build failures: Check if the build command is correct
   - Start failures: Verify the start command and environment variables

### Database Connection Issues

1. Verify the `DATABASE_URL` environment variable is correct
2. Check if the database is running in the **Status** tab of your PostgreSQL service
3. Try connecting manually using the Render shell:
   ```bash
   psql $DATABASE_URL
   ```

### Application Not Responding

1. Check the application logs in the **Logs** tab
2. Verify your health check path is correct
3. Check if the application is exceeding memory limits (visible in the **Metrics** tab)

## Maintenance

### Updating the Application

Push your changes to the connected GitHub repository. Render will automatically deploy the updates (if auto-deploy is enabled).

For manual updates:
1. Go to your Web Service dashboard
2. Click **Manual Deploy** > **Deploy latest commit**

### Backing Up the Database

Render automatically takes daily backups of your PostgreSQL database.

To create a manual backup:
1. Go to your PostgreSQL service dashboard
2. Click **Backups** tab
3. Click **Manual Backup**

To restore from a backup:
1. Go to the **Backups** tab
2. Find the backup you want to restore
3. Click the three dots menu > **Restore**

## Cost Optimization

- **Free Tier Limitations**: Free tier web services on Render sleep after 15 minutes of inactivity
- **Development vs. Production**: Use the free tier for development, then upgrade to a paid plan for production
- **Scaling Resources**: Start with minimal resources and scale up as needed

## Security Considerations

- Change the default admin password immediately
- Restrict access to the admin area using IP allowlisting:
  1. Go to your Web Service's **Settings** tab
  2. Find **IP Allowlisting** and add your trusted IPs
- Ensure your database is not publicly accessible (use Internal Database URL)
- Enable 2FA for your Render.com account