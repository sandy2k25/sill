# Setting Up Telegram Integration for Sill on VPS

This guide focuses specifically on setting up the Telegram integration when deploying Sill to a VPS.

## Why Telegram Integration?

Sill uses Telegram as a storage backend through a bot that saves data to a specified channel/chat. This gives you:

- Data persistence without a traditional database
- Easy backup/restore functionality
- Simple integration on any hosting platform

## Step 1: Create a Telegram Bot

1. Open Telegram and search for "BotFather" (@BotFather)
2. Start a chat and send `/newbot`
3. Follow the instructions to create a bot:
   - Provide a name for your bot
   - Provide a username ending with "bot" (e.g., sill_data_bot)
4. **IMPORTANT**: BotFather will respond with a token. Save this token securely - you'll need it later.

## Step 2: Create a Channel for Data Storage

1. In Telegram, create a new channel (can be public or private)
2. Add your newly created bot as an administrator to this channel
3. Make sure the bot has permission to post messages

## Step 3: Get the Channel ID

Method 1 (For public channels):
- The channel ID is simply `@your_channel_name`

Method 2 (For private channels):
1. Send a message to the channel
2. Forward that message to "@getidsbot" or other similar bot
3. The bot will respond with the channel ID (usually starts with -100)

## Step 4: Configure Your VPS Deployment

When setting up Sill on your VPS, you need to provide two environment variables:

```
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_channel_id
```

### Using the Automated Deployment Scripts

Our deployment scripts will prompt you for these values:

```bash
# PM2 version
curl -s https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill-pm2.sh | bash

# OR Systemd version
curl -s https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill.sh | bash

# OR Android-friendly version
curl -s https://raw.githubusercontent.com/sandy2k25/sill/main/android-deploy.sh | bash
```

### Manual Configuration

If you're setting up manually, add these to your `.env` file:

```bash
nano /var/www/sill/.env
```

Add or update these lines:
```
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_channel_id
```

After editing, restart the application:
```bash
# If using PM2
pm2 restart sill

# If using systemd
sudo systemctl restart sill
```

## Troubleshooting Telegram Integration

If you see "Telegram bot token not found or invalid" in your logs:

1. Verify your `TELEGRAM_BOT_TOKEN` is correct
2. Check that your bot is still active with BotFather
3. Make sure the bot has been added as an admin to your channel
4. Ensure the environment variables are properly set

To check logs:

```bash
# PM2 logs
pm2 logs sill

# Or systemd logs
sudo journalctl -u sill -f
```

## Testing Your Telegram Integration

After setting everything up:

1. Access your Sill admin panel
2. Try performing an action that requires data storage (creating a user, updating settings, etc.)
3. Check your Telegram channel - you should see new messages with JSON data
4. If messages appear in your channel, the integration is working correctly

## Advanced: Restoring From Telegram Backup

If you need to restore data from your Telegram channel to a new server:

1. Set up Sill with the same Telegram bot and channel
2. The application will automatically load all previous data from the channel
3. This makes migration between servers extremely simple