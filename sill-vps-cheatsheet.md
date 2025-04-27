# Sill VPS Deployment Cheatsheet

Quick reference guide for deploying https://github.com/sandy2k25/sill on a VPS.

## Automated Deployment

```bash
# Download the deployment script
wget https://raw.githubusercontent.com/sandy2k25/sill/main/deploy-sill-vps.sh

# Edit configuration variables
nano deploy-sill-vps.sh
# Change DB_PASSWORD, DOMAIN, etc.

# Make script executable
chmod +x deploy-sill-vps.sh

# Run the script with sudo
sudo ./deploy-sill-vps.sh
```

## Manual Deployment Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL, Nginx, Git
sudo apt install -y postgresql postgresql-contrib nginx git

# Install PM2
sudo npm install -g pm2
```

### 2. Database Setup

```bash
# Create database and user
sudo -u postgres psql -c "CREATE DATABASE silldb;"
sudo -u postgres psql -c "CREATE USER silluser WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE silldb TO silluser;"
```

### 3. Application Setup

```bash
# Clone repository
sudo mkdir -p /var/www/sill
sudo git clone https://github.com/sandy2k25/sill.git /var/www/sill
cd /var/www/sill

# Install dependencies & build
sudo npm install
sudo npm run build

# Create .env file
sudo tee .env > /dev/null << EOL
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://silluser:your_password@localhost:5432/silldb
EOL

# Initialize database
sudo npx drizzle-kit push

# Set up PM2
sudo tee ecosystem.config.js > /dev/null << EOL
module.exports = {
  apps: [{
    name: "sill",
    script: "./dist/index.js",
    env: {NODE_ENV: "production", PORT: 5000},
    instances: 1,
    autorestart: true
  }]
};
EOL

# Start application
sudo pm2 start ecosystem.config.js
sudo pm2 startup
sudo pm2 save
```

### 4. Nginx Configuration

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/sill > /dev/null << EOL
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable site & restart Nginx
sudo ln -s /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. Firewall Setup

```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## Common Commands

```bash
# View application logs
pm2 logs sill

# Restart application
pm2 restart sill

# Update application
cd /var/www/sill
git pull
npm install
npm run build
pm2 restart sill

# Database backup
pg_dump -U silluser -h localhost silldb > sill_backup.sql

# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check logs: `pm2 logs sill` |
| Database connection | Verify credentials in .env file |
| Nginx 502 error | Ensure app is running: `pm2 status` |
| SSL certificate | Run: `sudo certbot --nginx -d your-domain.com` |

## Security Checklist

- [ ] Change default admin password
- [ ] Configure regular database backups  
- [ ] Set up fail2ban: `sudo apt install -y fail2ban`
- [ ] Enable automatic system updates
- [ ] Secure PostgreSQL: `sudo nano /etc/postgresql/*/main/pg_hba.conf`
- [ ] Set proper file permissions: `sudo chown -R www-data:www-data /var/www/sill`