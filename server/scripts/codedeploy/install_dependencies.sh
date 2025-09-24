#!/bin/bash

cd /opt/aiphoto-server

# Install production dependencies
npm ci --only=production

# Run database migrations
npm run db:migrate

echo "Dependencies installed and database migrated"