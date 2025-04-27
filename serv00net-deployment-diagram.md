# serv00.net Deployment Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Local Machine  │────▶│   Build & Pack  │────▶│  Upload Files   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Start Service  │◀────│ Initialize DB   │◀────│  Configure Env  │
│                 │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Access Admin   │────▶│  Start Using!   │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
```

## Step-by-Step Process

1. **Local Machine**
   - Clone the repository
   - Install dependencies
   - Make any needed customizations

2. **Build & Pack**
   - Run `npm run build` or `./deploy-to-serv00net.sh`
   - Generates the deployment package

3. **Upload Files**
   - Use FTP/SFTP to upload files to serv00.net
   - Make sure file permissions are correct

4. **Configure Environment**
   - Set up environment variables in serv00.net panel
   - Configure domain settings
   - Set up PostgreSQL database

5. **Initialize Database**
   - Run `npx drizzle-kit push` to create tables
   - Initial data setup happens automatically

6. **Start Service**
   - Use PM2 or serv00.net's application manager
   - Configure for auto-restart

7. **Access Admin**
   - Go to yourdomain.com/nimda
   - Log in with default credentials
   - Change the default password

8. **Start Using!**
   - Configure whitelist domains
   - Test video scraping and playback
   - Customize additional settings

## Architecture Overview

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

## Required Ports & Connections

```
User Browser ──────▶ serv00.net (Port 80/443) ──────▶ Application (Port 5000)
                                │
                                ▼
                         PostgreSQL (Port 5432)
                                │
Application ───────────────────▶◀──────────────────▶ letsembed.cc (Scraping)
                                │
                                ▼
Application ───────────────────▶◀──────────────────▶ Telegram API (Optional)
```