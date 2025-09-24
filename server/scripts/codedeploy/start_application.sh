#!/bin/bash

# Run database migrations
echo "Running database migrations..."
cd /opt/aiphoto-server
npm run db:migrate || echo "Migration failed or already applied"

# Start the application service
systemctl daemon-reload
systemctl enable aiphoto-server
systemctl start aiphoto-server

echo "Application started"