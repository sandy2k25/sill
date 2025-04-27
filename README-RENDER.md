# Deploy Sill to Render.com

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sandy2k25/sill)

## Quick Deployment Steps

1. Click the "Deploy to Render" button above
2. Login to your Render account (or create one)
3. Configure the required environment variables:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token 
   - `TELEGRAM_CHANNEL_ID`: Your Telegram channel ID
   - `TELEGRAM_BOT_ADMIN_PASSWORD`: Password for Telegram bot admin access
   - `ADMIN_PASSWORD`: Password for web admin interface

## After Deployment

1. Access the admin area at: `https://your-service-name.onrender.com/nimda`
2. Default login (if ADMIN_PASSWORD not set):
   - Username: `admin`
   - Password: `admin123`
3. Change the default password immediately!

## Complete Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.