# Sill Deployment Visual Guide

This visual guide shows how to deploy the Sill project from GitHub to serv00.net.

## Deployment Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Clone GitHub   │────▶│  Build Project  │────▶│  Create Package │
│  Repository     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
       │                                                  │
       │                                                  │
       │                                                  ▼
       │                                         ┌─────────────────┐
       │                                         │                 │
       │                                         │ Upload to       │
       │                                         │ serv00.net      │
       │                                         │                 │
       │                                         └────────┬────────┘
       │                                                  │
       ▼                                                  ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│ Pull Updates    │◀────│ Run Application │◀────│ Setup Database  │
│ (Maintenance)   │     │                 │     │ & Environment   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Step 1: Clone the Repository

```bash
git clone https://github.com/sandy2k25/sill.git
cd sill
```

## Step 2: Build the Project

```bash
npm install
npm run build
```

## Step 3: Create Deployment Package

Use the provided script:

```bash
chmod +x deploy-sill.sh
./deploy-sill.sh
```

This creates a `sill-deploy` directory and a `sill-deploy.tar.gz` archive.

## Step 4: Upload to serv00.net

Option A: Upload the directory
- Use FTP/SFTP to upload the entire `sill-deploy` directory

Option B: Upload the archive
- Upload `sill-deploy.tar.gz`
- Extract it on the server:
  ```bash
  tar -xzf sill-deploy.tar.gz
  ```

## Step 5: Setup Database & Environment

1. Create PostgreSQL database in serv00.net control panel
2. Set environment variables:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
3. Initialize database:
   ```bash
   npx drizzle-kit push
   ```

## Step 6: Run the Application

Using PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## Step 7: First Login & Setup

1. Access: `yourdomain.com/nimda`
2. Login with: `admin` / `admin123`
3. Change the default password
4. Configure whitelisted domains

## Maintenance: Pulling Updates

```bash
# Go to your project directory
cd /path/to/sill

# Pull updates from GitHub
git pull origin main

# Rebuild the project
npm install
npm run build

# Restart the application
pm2 restart sill
```

## serv00.net Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      serv00.net Server                    │
│                                                           │
│  ┌─────────────┐      ┌─────────────┐      ┌──────────┐  │
│  │             │      │             │      │          │  │
│  │  Node.js    │◀────▶│  Express    │◀────▶│  React   │  │
│  │  Server     │      │  API        │      │  Frontend│  │
│  │             │      │             │      │          │  │
│  └──────┬──────┘      └─────────────┘      └──────────┘  │
│         │                                                 │
│  ┌──────▼──────┐      ┌─────────────┐      ┌──────────┐  │
│  │             │      │             │      │          │  │
│  │ PostgreSQL  │◀────▶│  WovIeX     │◀────▶│ Telegram │  │
│  │ Database    │      │  Scraper    │      │ Bot      │  │
│  │             │      │             │      │          │  │
│  └─────────────┘      └─────────────┘      └──────────┘  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Required Environment Variables

| Variable             | Description                     | Required |
|----------------------|---------------------------------|----------|
| NODE_ENV             | Set to "production"             | Yes      |
| PORT                 | Default: 5000                   | Yes      |
| DATABASE_URL         | PostgreSQL connection string    | Yes      |
| TELEGRAM_BOT_TOKEN   | For Telegram bot integration    | No       |
| TELEGRAM_CHANNEL_ID  | For Telegram storage            | No       |

## Common Issues & Solutions

| Issue                   | Solution                                        |
|-------------------------|------------------------------------------------|
| Application won't start | Check logs, verify environment variables        |
| Database connection     | Verify DATABASE_URL format and credentials      |
| Video scraping fails    | Ensure outbound connections are allowed         |
| Telegram issues         | Verify bot token and channel access permissions |