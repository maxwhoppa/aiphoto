#!/bin/bash

# Local deployment script for testing
# Simulates the production deployment process

set -e

echo "Starting local deployment..."

# Build the application
echo "Building application..."
npm run build

# Create deployment package
echo "Creating deployment package..."
mkdir -p deploy-temp
cp -r dist package.json package-lock.json drizzle deploy-temp/

# Create systemd-style environment file
cat > deploy-temp/.env <<EOF
NODE_ENV=development
PORT=80
DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/aiphoto}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_NAME=${S3_BUCKET_NAME:-aiphoto-images-dev}
SQS_QUEUE_URL=${SQS_QUEUE_URL}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_REGION=${COGNITO_REGION:-us-east-1}
GOOGLE_GEMINI_API_KEY=${GOOGLE_GEMINI_API_KEY}
CORS_ORIGIN=${CORS_ORIGIN:-http://localhost,http://localhost:19006}
EOF

# Install production dependencies
cd deploy-temp
echo "Installing production dependencies..."
npm ci --only=production

echo "Running database migrations..."
npm run db:migrate

echo "Starting application..."
npm start

echo "Local deployment complete!"