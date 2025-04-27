/**
 * prepare-serv00-shell-package.js
 * 
 * This script prepares a deployment package specifically optimized for serv00.net hosting
 * with shell-only access (no admin privileges). It creates a minimal, self-contained
 * deployable package with all necessary files and additional scripts for shell environments.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DEPLOY_DIR = path.join(__dirname, 'serv00-shell-deploy');
const INCLUDE_NODE_MODULES = true; // Set to true for complete offline deployment

console.log('🚀 Preparing shell-compatible deployment package for serv00.net...');

// Create deployment directory
if (fs.existsSync(DEPLOY_DIR)) {
  console.log('Cleaning existing deployment directory...');
  fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
}

fs.mkdirSync(DEPLOY_DIR, { recursive: true });
fs.mkdirSync(path.join(DEPLOY_DIR, 'dist'), { recursive: true });
fs.mkdirSync(path.join(DEPLOY_DIR, 'scripts'), { recursive: true });

// Build the application
console.log('Building application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed. Please fix the errors and try again.');
  process.exit(1);
}

// Helper function to copy files
function copyFiles(source, dest) {
  if (!fs.existsSync(source)) {
    console.warn(`⚠️ Warning: ${source} does not exist, skipping...`);
    return;
  }
  
  if (fs.lstatSync(source).isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(source);
    for (const entry of entries) {
      const srcPath = path.join(source, entry);
      const destPath = path.join(dest, entry);
      copyFiles(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(source, dest);
  }
}

// Copy dist folder (compiled application)
copyFiles(path.join(__dirname, 'dist'), path.join(DEPLOY_DIR, 'dist'));

// Copy critical files
const criticalFiles = [
  'package.json',
  'package-lock.json',
  'player_template_simple.html',
  'drizzle.config.ts'
];

for (const file of criticalFiles) {
  if (fs.existsSync(path.join(__dirname, file))) {
    fs.copyFileSync(
      path.join(__dirname, file), 
      path.join(DEPLOY_DIR, file)
    );
    console.log(`Copied ${file}`);
  } else {
    console.warn(`⚠️ Warning: ${file} not found, skipping...`);
  }
}

// Copy node_modules if configured
if (INCLUDE_NODE_MODULES) {
  console.log('Copying node_modules (this may take a while)...');
  copyFiles(
    path.join(__dirname, 'node_modules'), 
    path.join(DEPLOY_DIR, 'node_modules')
  );
}

// Create production package.json
const packageJson = require('./package.json');
const prodPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  license: packageJson.license,
  scripts: {
    start: 'NODE_ENV=production node dist/index.js',
    'db:push': 'drizzle-kit push',
    'check:port': 'node scripts/check-port.js',
    'check:deps': 'node scripts/check-deps.js'
  },
  dependencies: packageJson.dependencies
};

// Write the simplified package.json
fs.writeFileSync(
  path.join(DEPLOY_DIR, 'package.json'),
  JSON.stringify(prodPackageJson, null, 2)
);

// Create starter script
const startScript = `#!/bin/bash
# Start script for serv00.net (shell-only)

# Source environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Configure default environment variables if not set
export NODE_ENV=\${NODE_ENV:-production}
export PORT=\${PORT:-5000}

# Check if port is available
if command -v netstat &> /dev/null; then
  PORT_IN_USE=\$(netstat -tulpn 2>/dev/null | grep :\${PORT})
  if [ ! -z "\$PORT_IN_USE" ]; then
    echo "⚠️ Warning: Port \${PORT} is already in use:"
    echo "\$PORT_IN_USE"
    echo "You may need to kill the existing process or change the PORT in .env"
    exit 1
  fi
fi

echo "📝 Starting application on port \${PORT}..."
echo "📅 Start time: $(date)"
echo "💻 Running as user: $(whoami)"
echo "📂 Directory: $(pwd)"

# Start the application
node dist/index.js
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'start.sh'), startScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'start.sh'), '755');

// Create an enhanced background start script for shell environments
const bgStartScript = `#!/bin/bash
# Background start script for serv00.net (shell-only)

# Helper to get PID of running app
get_pid() {
  ps aux | grep "node dist/index.js" | grep -v grep | awk '{print $2}'
}

# Check if already running
PID=$(get_pid)
if [ ! -z "$PID" ]; then
  echo "⚠️ Application is already running with PID: $PID"
  echo "To restart, run: ./stop.sh && ./start-bg.sh"
  exit 1
fi

# Run the app in background and log output
nohup ./start.sh > app.log 2>&1 &

# Verify it started
sleep 2
PID=$(get_pid)
if [ ! -z "$PID" ]; then
  echo "✅ Application started successfully with PID: $PID"
  echo "📝 Logs available at: $(pwd)/app.log"
  echo "💡 To view logs in real-time: tail -f app.log"
  echo "🛑 To stop the application: ./stop.sh"
else
  echo "❌ Failed to start application. Check app.log for errors."
fi
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'start-bg.sh'), bgStartScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'start-bg.sh'), '755');

// Create stop script
const stopScript = `#!/bin/bash
# Stop script for serv00.net (shell-only)

# Find PID of the application
PID=$(ps aux | grep "node dist/index.js" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
  echo "⚠️ No running application found."
  exit 0
fi

echo "🛑 Stopping application with PID: $PID"
kill -15 $PID

# Verify it stopped
sleep 2
PID_CHECK=$(ps aux | grep "node dist/index.js" | grep -v grep | awk '{print $2}')
if [ -z "$PID_CHECK" ]; then
  echo "✅ Application stopped successfully."
else
  echo "⚠️ Application did not stop gracefully, force killing..."
  kill -9 $PID_CHECK
  echo "✅ Application terminated."
fi
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'stop.sh'), stopScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'stop.sh'), '755');

// Create restart script
const restartScript = `#!/bin/bash
# Restart script for serv00.net (shell-only)

echo "🔄 Restarting application..."
./stop.sh
./start-bg.sh
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'restart.sh'), restartScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'restart.sh'), '755');

// Create status checker script
const statusScript = `#!/bin/bash
# Status script for serv00.net (shell-only)

# Find PID of the application
PID=$(ps aux | grep "node dist/index.js" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
  echo "❌ Application is NOT running."
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi
PORT=\${PORT:-5000}

# Check port binding
PORT_CHECK=$(netstat -tulpn 2>/dev/null | grep :$PORT)
if [ -z "$PORT_CHECK" ]; then
  echo "⚠️ Application is running (PID: $PID) but not listening on port $PORT."
  exit 2
fi

# Basic info
UPTIME=$(ps -p $PID -o etime= 2>/dev/null)
MEM=$(ps -p $PID -o %mem= 2>/dev/null)
CPU=$(ps -p $PID -o %cpu= 2>/dev/null)

echo "✅ Application status:"
echo "🆔 PID: $PID"
echo "⏱️ Uptime: $UPTIME"
echo "🖥️ Memory usage: $MEM%"
echo "⚙️ CPU usage: $CPU%"
echo "🌐 Listening on port: $PORT"
echo "📝 Log file: $(pwd)/app.log"
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'status.sh'), statusScript);
fs.chmodSync(path.join(DEPLOY_DIR, 'status.sh'), '755');

// Create dependency checker script
const checkDepsScript = `// check-deps.js
// Utility to verify dependencies are installed and working

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Checking Node.js environment...');

// Check Node.js version
try {
  const nodeVersion = execSync('node -v').toString().trim();
  console.log('✅ Node.js version:', nodeVersion);
  
  // Warning for old Node.js versions
  const versionNum = nodeVersion.replace('v', '').split('.').map(Number);
  if (versionNum[0] < 16) {
    console.log('⚠️ Warning: Node.js version is below recommended (v16+)');
  }
} catch (error) {
  console.error('❌ Error checking Node.js:', error.message);
}

// Check NPM
try {
  const npmVersion = execSync('npm -v').toString().trim();
  console.log('✅ npm version:', npmVersion);
} catch (error) {
  console.error('❌ Error checking npm:', error.message);
}

// Check if required binaries are available
const binaries = ['node', 'npm', 'npx', 'netstat', 'ps', 'grep', 'awk'];
console.log('\\n🔍 Checking required binaries...');

binaries.forEach(binary => {
  try {
    execSync(\`which \${binary}\`);
    console.log(\`✅ \${binary} is available\`);
  } catch (error) {
    console.log(\`❌ \${binary} is not available\`);
  }
});

// Check PostgreSQL client
console.log('\\n🔍 Checking PostgreSQL client...');
try {
  execSync('which psql');
  const psqlVersion = execSync('psql --version').toString().trim();
  console.log(\`✅ PostgreSQL client: \${psqlVersion}\`);
} catch (error) {
  console.log('⚠️ PostgreSQL client (psql) not found. Database migrations might require additional setup.');
}

// Check for package.json and node_modules
console.log('\\n🔍 Checking package dependencies...');
if (fs.existsSync('./package.json')) {
  console.log('✅ package.json exists');
  
  if (fs.existsSync('./node_modules')) {
    console.log('✅ node_modules directory exists');
    
    // Check for key dependencies
    const keyDeps = ['express', 'drizzle-orm', 'react', 'telegraf'];
    keyDeps.forEach(dep => {
      if (fs.existsSync(\`./node_modules/\${dep}\`)) {
        console.log(\`✅ \${dep} is installed\`);
      } else {
        console.log(\`❌ \${dep} is missing. Try running: npm ci\`);
      }
    });
  } else {
    console.log('❌ node_modules directory is missing. Run: npm ci');
  }
} else {
  console.log('❌ package.json is missing!');
}

// Check for required files
console.log('\\n🔍 Checking required application files...');
const requiredFiles = [
  './dist/index.js',
  './player_template_simple.html',
  './drizzle.config.ts'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(\`✅ \${file} exists\`);
  } else {
    console.log(\`❌ \${file} is missing!\`);
  }
});

// Overall summary
console.log('\\n📋 Environment check complete!');
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'scripts/check-deps.js'), checkDepsScript);

// Create port checker script
const checkPortScript = `// check-port.js
// Utility to check if the application port is available

const net = require('net');
const fs = require('fs');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

console.log(\`🔍 Checking if port \${PORT} is available...\`);

const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(\`❌ Port \${PORT} is already in use!\\n\`);
    console.log('This could mean:');
    console.log('1. Another application is using this port');
    console.log('2. Your WovIeX application is already running');
    console.log('\\nTo fix this issue:');
    console.log('- Run "./status.sh" to check if your application is running');
    console.log('- Run "./stop.sh" to stop a running application');
    console.log('- Change the PORT in your .env file');
    process.exit(1);
  } else {
    console.log(\`❌ Error checking port \${PORT}: \${err.message}\`);
    process.exit(1);
  }
});

server.once('listening', () => {
  console.log(\`✅ Port \${PORT} is available and ready to use!\`);
  server.close();
});

server.listen(PORT);
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'scripts/check-port.js'), checkPortScript);

// Create sample .env file
const sampleEnv = `# Environment Variables for serv00.net
# This is the main configuration file for your application

# Required
NODE_ENV=production
PORT=5000

# Database connection
# Replace with your serv00.net PostgreSQL credentials
DATABASE_URL=postgresql://username:password@localhost:5432/databasename

# Admin authentication
ADMIN_PASSWORD=change_this_password_immediately

# Telegram integration (optional)
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHANNEL_ID=your_telegram_channel_id
# TELEGRAM_BOT_ADMIN_PASSWORD=your_secure_bot_admin_password
`;

fs.writeFileSync(path.join(DEPLOY_DIR, '.env.sample'), sampleEnv);

// Create .htaccess file for Apache
const htaccess = `# .htaccess for serv00.net shell environment
<IfModule mod_rewrite.c>
  RewriteEngine On
  
  # Proxy requests to the Node.js application running on port 5000
  RewriteRule ^$ http://localhost:5000/ [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://localhost:5000/$1 [P,L]
</IfModule>

# Set headers for better security
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Disable directory listing
Options -Indexes
`;

fs.writeFileSync(path.join(DEPLOY_DIR, '.htaccess'), htaccess);

// Create comprehensive README with detailed instructions
const readme = `# WovIeX - Serv00.net Shell Deployment Package

This package contains everything needed to deploy WovIeX on Serv00.net with shell-only access.

## 📋 Quick Start Guide

1. **Upload this package** to your Serv00.net account
2. **Connect via SSH** to your Serv00.net shell
3. **Configure environment**: \`cp .env.sample .env && nano .env\`
4. **Check dependencies**: \`node scripts/check-deps.js\`
5. **Initialize database**: \`npx drizzle-kit push\`
6. **Start application**: \`./start-bg.sh\`
7. **Check status**: \`./status.sh\`

## 🛠️ Available Scripts

| Script | Purpose |
|--------|---------|
| \`./start.sh\` | Start in foreground |
| \`./start-bg.sh\` | Start in background |
| \`./stop.sh\` | Stop the application |
| \`./restart.sh\` | Restart the application |
| \`./status.sh\` | Check application status |
| \`node scripts/check-deps.js\` | Verify environment |
| \`node scripts/check-port.js\` | Check if port is available |

## 📂 Directory Structure

- \`dist/\`: Compiled application
- \`node_modules/\`: Dependencies
- \`scripts/\`: Utility scripts
- \`.htaccess\`: Apache configuration
- \`player_template_simple.html\`: Video player template

## 🔧 Configuration

1. **Copy the sample environment file**:
   \`\`\`
   cp .env.sample .env
   \`\`\`

2. **Edit .env file with your credentials**:
   \`\`\`
   nano .env
   \`\`\`
   
   Set these important variables:
   - DATABASE_URL: Your PostgreSQL connection string
   - ADMIN_PASSWORD: Password for admin login
   - Telegram settings (if using Telegram features)

## 📝 Deployment Steps

### 1. Upload this package to Serv00.net

Using SCP:
\`\`\`
scp -r serv00-shell-deploy/* username@your-serv00-hostname:~/public_html/
\`\`\`

Or using an archive:
\`\`\`
tar -czf deploy.tar.gz -C serv00-shell-deploy .
scp deploy.tar.gz username@your-serv00-hostname:~/public_html/
\`\`\`

### 2. Connect via SSH
\`\`\`
ssh username@your-serv00-hostname
\`\`\`

### 3. Navigate to your web directory
\`\`\`
cd ~/public_html
\`\`\`

### 4. If you uploaded an archive, extract it
\`\`\`
tar -xzf deploy.tar.gz
\`\`\`

### 5. Configure environment
\`\`\`
cp .env.sample .env
nano .env
\`\`\`

### 6. Check environment and dependencies
\`\`\`
node scripts/check-deps.js
\`\`\`

### 7. Initialize database
\`\`\`
npx drizzle-kit push
\`\`\`

### 8. Start the application
\`\`\`
./start-bg.sh
\`\`\`

### 9. Check if it's running
\`\`\`
./status.sh
\`\`\`

## 🔍 Troubleshooting

### Application won't start
- Check logs: \`tail -f app.log\`
- Verify .env configuration
- Check port availability: \`node scripts/check-port.js\`
- Ensure database connection is working

### Cannot access web interface
- Verify application is running: \`./status.sh\`
- Check .htaccess configuration
- Contact Serv00.net support for specific URL rewriting requirements

### Database errors
- Verify PostgreSQL credentials
- Ensure database exists and is accessible
- Run database check: \`npx drizzle-kit check\`

## 🔐 Security Notes

- Change default admin password immediately
- Keep your .env file secure
- Regularly check logs for suspicious activity
- Update your application when new versions are available

## 👤 Default Credentials

**Admin Login:**
- URL: https://your-domain.com/nimda
- Username: admin
- Password: [Value from ADMIN_PASSWORD in .env]

CHANGE THE DEFAULT PASSWORD IMMEDIATELY AFTER FIRST LOGIN!

## 📞 Need Help?

If you encounter issues not covered in this README:
1. Check the application logs: \`tail -f app.log\`
2. Verify your environment configuration
3. Contact support with detailed error information
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'README.md'), readme);

console.log('✅ Shell-compatible deployment package created successfully!');
console.log(`📁 Location: ${DEPLOY_DIR}`);
console.log('📋 Next steps:');
console.log('  1. Upload the contents of this directory to serv00.net');
console.log('  2. Follow the detailed instructions in README.md');
console.log('\nFor complete step-by-step instructions, see SERV00NET_SHELL_DEPLOYMENT.md');