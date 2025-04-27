# WovIeX

A sophisticated web scraping application for extracting video URLs with advanced admin and user interfaces. Provides robust video management through web and Telegram platforms, implementing embed protection and enhanced video playback with improved server-side compatibility.

## Features

- 🎬 Video URL extraction and embedding
- 🔒 Admin web interface with authentication
- 🤖 Telegram bot for remote management
- 🌐 Domain whitelisting system
- 🗄️ Video cache management
- 🎥 Enhanced video playback with Plyr.io

## Tech Stack

- Frontend: React + TypeScript
- Backend: Express + TypeScript
- Styling: Tailwind CSS
- Video Player: Plyr.io
- Bot Integration: Telegraf
- Database: PostgreSQL (optional)

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm (v8 or later)
- Telegram Bot Token (for admin functionality)
- Telegram Channel (for storage)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wovie-app.git
cd wovie-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```
# Required environment variables
NODE_ENV=development
PORT=5000

# Admin authentication 
ADMIN_PASSWORD=your_admin_password_here

# Telegram Bot configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHANNEL_ID=your_telegram_channel_id_here
TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_bot_admin_password_here

# Optional: Database configuration (if using PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

4. Start the development server:
```bash
npm run dev
```

5. Access the application:
   - Main application: `http://localhost:5000`
   - Admin interface: `http://localhost:5000/admin`

## Deployment Options

### GitHub Pages (Frontend Only)

For a static frontend-only deployment, use:

```bash
npm run build:github
```

Then enable GitHub Pages in your repository settings.

### Full Stack Deployment

For full-stack functionality, we provide configuration for various deployment options:

1. See `GITHUB_HOSTING.md` for GitHub deployment details
2. See `UBUNTU-VPS-DEPLOYMENT.md` for VPS deployment instructions
3. See `QUICK-DEPLOY.md` for a simplified deployment guide

## Documentation

- [GitHub Hosting Guide](GITHUB_HOSTING.md)
- [VPS Deployment Guide](UBUNTU-VPS-DEPLOYMENT.md)
- [Quick Deployment Guide](QUICK-DEPLOY.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Plyr.io](https://plyr.io/) for the video player
- [Telegraf](https://telegraf.js.org/) for the Telegram bot integration
- [Tailwind CSS](https://tailwindcss.com/) for the styling framework
- [Shadcn/ui](https://ui.shadcn.com/) for UI components