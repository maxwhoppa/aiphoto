#!/bin/bash

echo "Initializing LocalStack AWS services..."

# Create S3 bucket
awslocal s3 mb s3://aiphoto-images
awslocal s3api put-bucket-cors --bucket aiphoto-images --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

# Create SQS queue
awslocal sqs create-queue --queue-name aiphoto-image-processing

# Create SSM parameters for configuration
awslocal ssm put-parameter --name "/aiphoto/dev/database-url" --value "postgresql://postgres:postgres@postgres:5432/aiphoto" --type "String"
awslocal ssm put-parameter --name "/aiphoto/dev/redis-url" --value "redis://redis:6379" --type "String"
awslocal ssm put-parameter --name "/aiphoto/dev/s3-bucket" --value "aiphoto-images" --type "String"

echo "LocalStack initialization completed!"