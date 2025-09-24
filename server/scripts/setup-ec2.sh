#!/bin/bash

# EC2 Setup Script for AI Photo Server
# Run this script on your EC2 instance to set up the environment

set -e

echo "Setting up AI Photo Server on EC2..."

# Update system
sudo yum update -y

# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash aiphoto || echo "User already exists"

# Create application directories
sudo mkdir -p /opt/aiphoto-server
sudo mkdir -p /opt/aiphoto-server/logs
sudo chown -R aiphoto:aiphoto /opt/aiphoto-server

# Create systemd service file
sudo tee /etc/systemd/system/aiphoto-server.service > /dev/null <<EOF
[Unit]
Description=AI Photo Server
After=network.target

[Service]
Type=simple
User=aiphoto
WorkingDirectory=/opt/aiphoto-server
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=aiphoto-server

[Install]
WantedBy=multi-user.target
EOF

# Create environment file template
sudo tee /opt/aiphoto-server/.env.template > /dev/null <<EOF
# Database
DATABASE_URL=postgresql://username:password@hostname:5432/database

# Redis (optional)
REDIS_URL=redis://localhost:6379

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=your_bucket_name
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/account/queue-name

# Cognito
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_REGION=us-east-1

# Google Gemini
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Application
NODE_ENV=production
PORT=80
CORS_ORIGIN=https://yourdomain.com

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
EOF

# Set up log rotation
sudo tee /etc/logrotate.d/aiphoto-server > /dev/null <<EOF
/opt/aiphoto-server/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 aiphoto aiphoto
    postrotate
        /bin/systemctl reload aiphoto-server > /dev/null 2>&1 || true
    endscript
}
EOF

# Configure firewall
sudo yum install -y firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --zone=public --add-port=80/tcp
sudo firewall-cmd --permanent --zone=public --add-port=443/tcp
sudo firewall-cmd --permanent --zone=public --add-service=ssh
sudo firewall-cmd --reload

# Reload systemd
sudo systemctl daemon-reload

echo "EC2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your environment variables to /opt/aiphoto-server/.env"
echo "2. Set NODE_ENV=production and PORT=80 in your .env file"
echo "3. Deploy your application to /opt/aiphoto-server"
echo "4. Run: sudo systemctl start aiphoto-server"
echo "5. Check status: sudo systemctl status aiphoto-server"
echo ""
echo "Useful commands:"
echo "- View logs: journalctl -u aiphoto-server -f"
echo "- Restart service: sudo systemctl restart aiphoto-server"
echo "- Test health: curl http://localhost/health"