#!/bin/bash
# Sill Project Command Reference
# Copy and paste individual commands as needed

# ==== INSTALLATION COMMANDS ====

# 1. BASIC SETUP - Run these first
update_system() {
  sudo apt update
  sudo apt upgrade -y
  sudo apt install -y git curl nginx
}

install_nodejs() {
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
}

install_pm2() {
  sudo npm install -g pm2
}

# 2. GET APPLICATION CODE
clone_repository() {
  mkdir -p /var/www
  cd /var/www
  git clone https://github.com/sandy2k25/sill.git
  cd sill
  npm install
}

# 3. CONFIGURATION
create_env_file() {
  # Replace these values with your actual values
  JWT_SECRET=$(openssl rand -hex 32)
  
  cat > .env << EOL
NODE_ENV=production
PORT=5000
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-channel-id
EOL

  echo "Created .env file. Edit the values with: nano .env"
}

setup_nginx() {
  SERVER_IP=$(hostname -I | awk '{print $1}')
  
  sudo bash -c "cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOL"

  sudo ln -sf /etc/nginx/sites-available/sill /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl restart nginx
  
  echo "Nginx configured to serve at http://$SERVER_IP"
}

# 4. PROCESS MANAGEMENT
start_with_pm2() {
  cd /var/www/sill
  pm2 start npm --name "sill" -- start
  pm2 startup
  echo "Now run the command PM2 displays, then run: pm2 save"
}

setup_systemd() {
  sudo bash -c 'cat > /etc/systemd/system/sill.service << EOL
[Unit]
Description=Sill Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/sill
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL'

  sudo systemctl daemon-reload
  sudo systemctl enable sill
  sudo systemctl start sill
  
  echo "systemd service created and started"
}

# 5. SECURITY
setup_firewall() {
  sudo apt install -y ufw
  sudo ufw allow ssh
  sudo ufw allow http
  sudo ufw allow https
  sudo ufw --force enable
  
  echo "Firewall configured"
}

setup_ssl() {
  read -p "Enter your domain name: " DOMAIN
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d "$DOMAIN"
}

# ==== MANAGEMENT COMMANDS ====

# PM2 COMMANDS
view_pm2_status() {
  pm2 list
}

view_pm2_logs() {
  pm2 logs sill
}

restart_pm2() {
  pm2 restart sill
}

# SYSTEMD COMMANDS
view_systemd_status() {
  sudo systemctl status sill
}

view_systemd_logs() {
  sudo journalctl -u sill -f
}

restart_systemd() {
  sudo systemctl restart sill
}

# UPDATES
update_application() {
  cd /var/www/sill
  git pull
  npm install
  
  # Restart with either PM2 or systemd
  # pm2 restart sill
  # OR
  # sudo systemctl restart sill
}

# ==== USAGE EXAMPLES ====

# For a full installation with PM2:
# update_system
# install_nodejs
# install_pm2
# clone_repository
# create_env_file
# setup_nginx
# start_with_pm2
# setup_firewall

# For a full installation with systemd:
# update_system
# install_nodejs
# clone_repository
# create_env_file
# setup_nginx
# setup_systemd
# setup_firewall

# ===============================
# This is a reference file. Copy and paste the needed commands individually.
# ===============================