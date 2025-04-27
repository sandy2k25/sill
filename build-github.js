/**
 * Custom build script for GitHub Pages deployment
 * 
 * This script:
 * 1. Builds the frontend using the GitHub-specific Vite config
 * 2. Creates a simple static API mock for GitHub Pages (optional)
 * 3. Makes sure all routes can be properly handled by GitHub Pages
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

console.log(`${colors.bright}${colors.cyan}Starting GitHub Pages build process...${colors.reset}\n`);

// Build the frontend with GitHub-specific configuration
try {
  console.log(`${colors.yellow}Building frontend with GitHub Pages configuration...${colors.reset}`);
  execSync('npx vite build --config vite.config.github.ts', { stdio: 'inherit' });
  console.log(`${colors.green}Frontend build completed successfully.${colors.reset}\n`);
} catch (error) {
  console.error('Error building frontend:', error);
  process.exit(1);
}

// Create a _redirects file for services like Netlify or Vercel (optional)
const distDir = path.join(__dirname, 'dist', 'public');
const redirectsContent = `
# Handle Single Page Application routing
/*    /index.html   200
`;

try {
  fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent);
  console.log(`${colors.green}Created _redirects file for SPA routing.${colors.reset}`);
} catch (error) {
  console.error('Error creating _redirects file:', error);
}

// Create a 404.html that redirects to index.html for GitHub Pages
const notFoundContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <script>
    // Get the current path including hash
    const path = window.location.pathname + window.location.search + window.location.hash;
    // Remove the repository name from the path if it exists
    const basePath = document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
    const cleanPath = path.startsWith(basePath) ? path.slice(basePath.length) : path;
    // Redirect to the index.html with the path as a parameter
    window.location.href = basePath + '/index.html?redirect=' + encodeURIComponent(cleanPath);
  </script>
  <meta name="base-path" content="${process.env.VITE_BASE_URL || '/wovie-app/'}">
</head>
<body>
  <p>Redirecting to home page...</p>
</body>
</html>
`;

try {
  fs.writeFileSync(path.join(distDir, '404.html'), notFoundContent);
  console.log(`${colors.green}Created 404.html for GitHub Pages routing.${colors.reset}`);
} catch (error) {
  console.error('Error creating 404.html file:', error);
}

// Modify index.html to handle redirects
try {
  const indexPath = path.join(distDir, 'index.html');
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Add routing script to handle redirects from 404.html
  const scriptToAdd = `
  <script>
    // Check if we have a redirect parameter
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    if (redirectPath) {
      // Remove the redirect parameter from the URL
      urlParams.delete('redirect');
      const newSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
      // Create the new URL without the redirect parameter
      const cleanUrl = window.location.pathname + newSearch + redirectPath;
      // Update browser history without causing a page reload
      window.history.replaceState(null, null, cleanUrl);
    }
  </script>
  `;
  
  // Insert the script before the closing head tag
  indexContent = indexContent.replace('</head>', scriptToAdd + '</head>');
  
  // Write the modified index.html back to disk
  fs.writeFileSync(indexPath, indexContent);
  console.log(`${colors.green}Modified index.html to handle SPA routing.${colors.reset}`);
} catch (error) {
  console.error('Error modifying index.html:', error);
}

console.log(`\n${colors.bright}${colors.green}GitHub Pages build completed successfully!${colors.reset}`);
console.log(`${colors.yellow}Don't forget to update your repository settings to enable GitHub Pages.${colors.reset}`);