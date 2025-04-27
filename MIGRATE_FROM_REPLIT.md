# Migrating from Replit to GitHub

This guide provides step-by-step instructions for migrating your WovIeX application from Replit to GitHub and preparing it for deployment.

## Migration Steps

### 1. Export Code from Replit

1. Create a ZIP archive of your Replit project:
   - From your Replit project, click on the three dots menu in the Files panel
   - Select "Download as zip"
   - Save the ZIP file to your local machine

2. Extract the ZIP file to a local directory.

### 2. Set Up GitHub Repository

1. Create a new repository on GitHub:
   - Go to [GitHub](https://github.com) and log in
   - Click the "+" button in the top right and select "New repository"
   - Name your repository (e.g., "wovie-app")
   - Choose visibility (public or private)
   - Select "Add a README file" if you want to start with a README
   - Click "Create repository"

2. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/yourusername/wovie-app.git
   cd wovie-app
   ```

### 3. Configure for GitHub

1. Prepare your project for GitHub by copying these files from the extracted Replit project:
   - Copy all source code files
   - Copy configuration files (.env.example, etc.)
   - DO NOT copy Replit-specific configuration files (.replit, replit.nix)

2. Replace package.json or update it with GitHub-specific scripts:
   - Copy the `package.github.json` from this project
   - Rename it to `package.json` or merge its scripts with your existing package.json

3. Use the GitHub-specific Vite configuration:
   - Copy `vite.config.github.ts` to your project
   - When building for GitHub Pages, use this configuration

4. Add the GitHub workflow files for automatic deployment:
   - Create `.github/workflows/` directory
   - Copy the workflow files (`github-pages-deploy.yml` and `deploy-full.yml`)

### 4. Configure Environment Variables

1. Create a `.env.example` file (without real values) to show required variables:
   ```
   # Required environment variables
   NODE_ENV=production
   PORT=5000

   # Admin authentication 
   ADMIN_PASSWORD=your_admin_password_here

   # Telegram Bot configuration
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHANNEL_ID=your_telegram_channel_id_here
   TELEGRAM_BOT_ADMIN_PASSWORD=your_telegram_bot_admin_password_here
   ```

2. Set up secrets in your GitHub repository:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Add each environment variable as a secret (for production deployment)

### 5. Commit and Push to GitHub

1. Commit all files to your local repository:
   ```bash
   git add .
   git commit -m "Initial commit: Migrated from Replit"
   ```

2. Push to GitHub:
   ```bash
   git push origin main
   ```

### 6. Configure GitHub Pages (Frontend Only)

1. Build the project for GitHub Pages:
   ```bash
   npm run build:github
   ```

2. Enable GitHub Pages in repository settings:
   - Go to your GitHub repository
   - Navigate to Settings > Pages
   - Under "Source", select "GitHub Actions"
   - The workflow should automatically deploy your site

### 7. Full-Stack Deployment

For full-stack functionality (including backend), consider these options:

1. **Self-hosted server**:
   - Set up a VPS (see `UBUNTU-VPS-DEPLOYMENT.md`)
   - Configure the GitHub workflow to deploy to your server

2. **Platform as a Service**:
   - Configure for deployment to platforms like Vercel, Netlify, or Railway
   - Update the GitHub workflow file accordingly

## Additional Configuration

### Repository Files

Make sure your GitHub repository includes:

1. Documentation:
   - README.md
   - GITHUB_HOSTING.md
   - UBUNTU-VPS-DEPLOYMENT.md
   - QUICK-DEPLOY.md

2. Configuration:
   - vite.config.github.ts (for GitHub Pages)
   - .github/workflows/* (for GitHub Actions)
   - build-github.js (for GitHub-specific build)

3. Environment:
   - .env.example (template for required variables)
   - .env.production (for GitHub Pages frontend, with API URL)

### Handling Environment Variables

When migrating, you'll need to:

1. Transfer environment variables from Replit Secrets to GitHub Secrets
2. Update any hard-coded references to Replit-specific environment variables
3. For the front-end, use VITE_* prefix for any variables that should be exposed

## Troubleshooting

### Common Issues

1. **Missing dependencies**:
   - Ensure all dependencies are correctly listed in package.json
   - Run `npm install` to verify all dependencies install correctly

2. **Build errors**:
   - Check for Replit-specific code that might not work in other environments
   - Verify that paths and imports use correct syntax for the target environment

3. **Environment variables**:
   - Ensure all required environment variables are properly set
   - Check for any hardcoded Replit URLs or paths

### Getting Help

If you encounter issues not covered in this guide:

1. Check the GitHub repository Issues tab
2. Create a new issue with detailed information about your problem
3. Refer to the documentation for your deployment platform