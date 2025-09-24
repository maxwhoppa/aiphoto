# AI Photo Server - CloudFormation Deployment Guide

This guide explains how to deploy the AI Photo Server using CloudFormation and GitHub Actions. **No manual EC2 setup required!**

## 🚀 Quick Start

### 1. Set up AWS Prerequisites

#### Create an EC2 Key Pair
```bash
aws ec2 create-key-pair --key-name aiphoto-production --query 'KeyMaterial' --output text > ~/.ssh/aiphoto-production.pem
chmod 400 ~/.ssh/*.pem
```

#### Create S3 Bucket for CodeDeploy
```bash
aws s3 mb s3://your-codedeploy-bucket-name
```

#### Create RDS Database (example)
```bash
aws rds create-db-instance \
  --db-instance-identifier aiphoto-production-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username aiphoto \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-your-security-group
```

### 2. Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

#### Minimum Required GitHub Secrets
```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
SENTRY_DSN=your_sentry_dsn
```

#### Optional GitHub Secrets (will use .env defaults if not set)
```
KEY_PAIR_NAME=aiphoto-production (default: aiphoto-production)
DATABASE_URL=postgresql://user:pass@prod-db:5432/aiphoto (default: localhost)
REDIS_URL=redis://prod-redis:6379 (default: localhost)
COGNITO_USER_POOL_ID=us-east-1_YourPool (default: us-east-1_64yfVC7J5)
COGNITO_REGION=us-east-1 (default: us-east-1)
S3_BUCKET_NAME=aiphoto-prod-images (default: aiphoto-images-dev)
CORS_ORIGIN=https://yourdomain.com (default: localhost)
```

### 3. Deploy to Production

Push to the `production` branch:

```bash
git checkout main
git pull origin main
git push origin main:production
```

**That's it!** GitHub Actions will:
1. ✅ Run tests and build the application
2. ✅ Deploy CloudFormation stack (VPC, ALB, ASG, EC2, etc.)
3. ✅ Deploy application via CodeDeploy
4. ✅ Run database migrations
5. ✅ Start the service

## 🏗️ Infrastructure Components

The CloudFormation template creates:

### **Networking**
- VPC with 2 public subnets across AZs
- Internet Gateway and routing
- Security Groups for ALB and EC2

### **Compute**
- Auto Scaling Group (min: 1, max: 3)
- Application Load Balancer
- Launch Template with User Data script

### **Deployment**
- CodeDeploy Application and Deployment Group
- IAM roles and policies
- CloudWatch logging

### **Optional**
- Route53 DNS record (if domain provided)
- SSL certificate (manual setup required)

## 🔍 Monitoring and Debugging

### Check Deployment Status

**CloudFormation:**
```bash
aws cloudformation describe-stacks --stack-name aiphoto-production
```

**CodeDeploy:**
```bash
aws deploy list-deployments --application-name aiphoto-production-app
```

**EC2 Health:**
```bash
# Get ALB DNS
aws cloudformation describe-stacks --stack-name aiphoto-production --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text

# Test health endpoint
curl http://your-alb-dns/health
```

### SSH to EC2 Instance

```bash
# Get instance IP
aws ec2 describe-instances --filters "Name=tag:Name,Values=production-aiphoto-server" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

# SSH in
ssh -i ~/.ssh/aiphoto-production.pem ec2-user@instance-ip

# Check service
sudo systemctl status aiphoto-server
journalctl -u aiphoto-server -f
```

## 🛠️ Manual Operations

### Update Stack Parameters

Edit `cloudformation/parameters-production.json` and push to trigger redeployment.

### Manual Deployment

```bash
# Deploy infrastructure only
aws cloudformation deploy \
  --template-file server/cloudformation/infrastructure.yaml \
  --stack-name aiphoto-production \
  --parameter-overrides file://server/cloudformation/parameters-production.json \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy application only (after building)
aws deploy create-deployment \
  --application-name aiphoto-production-app \
  --deployment-group-name production-aiphoto-deployment-group \
  --s3-location bucket=your-codedeploy-bucket,key=deployment-package.zip,bundleType=zip
```

### Scale the Application

```bash
# Scale up
aws autoscaling set-desired-capacity --auto-scaling-group-name production-aiphoto-asg --desired-capacity 3

# Scale down
aws autoscaling set-desired-capacity --auto-scaling-group-name production-aiphoto-asg --desired-capacity 1
```

## 🚨 Troubleshooting

### Common Issues

**CloudFormation stack fails:**
- Check AWS limits (VPC, EIP, etc.)
- Verify IAM permissions
- Check parameter values

**Application doesn't start:**
- Check environment variables in `/opt/aiphoto-server/.env`
- Verify database connectivity
- Check application logs: `journalctl -u aiphoto-server`

**Health check fails:**
- Verify port 80 is open in security group
- Check if Node.js process is running
- Test locally: `curl http://localhost/health`

**CodeDeploy fails:**
- Check CodeDeploy agent status: `systemctl status codedeploy-agent`
- Verify S3 permissions
- Check deployment logs in AWS Console

### Recovery

**Rollback deployment:**
```bash
aws deploy stop-deployment --deployment-id deployment-id --auto-rollback-enabled
```

**Destroy and recreate stack:**
```bash
aws cloudformation delete-stack --stack-name aiphoto-production
# Wait for deletion, then push to redeploy
```

## 🔐 Security Notes

- All secrets are stored in GitHub Secrets (not in code)
- EC2 instances have minimal IAM permissions
- Security Groups restrict access to necessary ports only
- Database credentials are passed via environment variables
- SSL termination should be configured at ALB level

## 🎯 Next Steps

1. **SSL Certificate**: Set up AWS Certificate Manager and configure HTTPS
2. **Custom Domain**: Configure Route53 and update DNS
3. **Monitoring**: Set up CloudWatch alarms and dashboards
4. **Backup**: Configure RDS automated backups
5. **CDN**: Add CloudFront for static assets

The infrastructure is now fully automated and production-ready! 🚀