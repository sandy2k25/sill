# Fixing 403 Forbidden Errors with Sill on VPS

If you're seeing "Error 403: Access forbidden" or "You don't have permission to access the requested object/directory" errors, follow these steps to fix the issue.

## Quick Fix Commands

Copy and paste these commands to fix the most common permission issues:

```bash
# Fix file ownership and permissions
sudo chown -R www-data:www-data /var/www/sill
sudo find /var/www/sill -type d -exec chmod 755 {} \;
sudo find /var/www/sill -type f -exec chmod 644 {} \;

# Make sure the app can execute
sudo chmod 755 /var/www/sill/node_modules/.bin/*

# Fix Nginx configuration
sudo bash -c 'cat > /etc/nginx/sites-available/sill << EOL
server {
    listen 80;
    server_name $(hostname -I | awk "{print \$1}");

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL'

# Restart Nginx
sudo systemctl restart nginx

# Restart the application
# If using PM2:
pm2 restart sill
# If using systemd:
sudo systemctl restart sill
```

## Detailed Troubleshooting

### 1. Check if the application is running

First, make sure your app is actually running:

```bash
# For PM2:
pm2 list

# For systemd:
sudo systemctl status sill
```

If it's not running, start it:

```bash
# For PM2:
cd /var/www/sill
pm2 start npm --name "sill" -- start

# For systemd:
sudo systemctl start sill
```

### 2. Check application logs for errors

```bash
# For PM2:
pm2 logs sill --lines 100

# For systemd:
sudo journalctl -u sill --no-pager -n 100
```

### 3. Check Nginx configuration and logs

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -n 100 /var/log/nginx/error.log
```

### 4. Fix SELinux issues (if applicable)

On some systems, SELinux might be blocking access:

```bash
# Check if SELinux is enforcing
getenforce

# If it returns "Enforcing", you can try setting it to permissive temporarily:
sudo setenforce 0

# If that fixes the issue, you'll need to create proper SELinux policies or keep it in permissive mode:
sudo sed -i 's/SELINUX=enforcing/SELINUX=permissive/g' /etc/selinux/config
```

### 5. Check firewall settings

```bash
# Check if firewall is blocking connections
sudo ufw status

# Make sure HTTP and HTTPS are allowed
sudo ufw allow http
sudo ufw allow https
```

### 6. Verify the application port

Make sure the app is running on port 5000 (or whichever port you've configured):

```bash
# Check which processes are using which ports
sudo netstat -tulpn | grep LISTEN
```

If your app is running on a different port, update your Nginx configuration to match.

## Advanced: Manual Nginx Configuration Check

If you're still having issues, manually edit your Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/sill
```

Make sure it contains something like:

```
server {
    listen 80;
    server_name your-ip-or-domain;

    location / {
        proxy_pass http://localhost:5000;  # Make sure this port matches your app
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save, then restart Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```