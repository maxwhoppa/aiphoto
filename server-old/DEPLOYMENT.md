# AI Photo Server - Production Deployment Guide

## 🚀 Quick Deploy Checklist

### ✅ Prerequisites
- [ ] AWS Account with PowerUserAccess permissions
- [ ] Google Gemini API Key
- [ ] Sentry account (optional)
- [ ] GitHub repository

### ✅ First-Time Setup
1. **AWS Credentials**
   ```bash
   aws configure
   # OR set environment variables
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Store Production Secrets**
   ```bash
   aws ssm put-parameter --name "/aiphoto/prod/google-gemini-api-key" --value "YOUR_KEY" --type "SecureString"
   aws ssm put-parameter --name "/aiphoto/prod/sentry-dsn" --value "YOUR_DSN" --type "SecureString"
   ```

4. **Deploy**
   ```bash
   npx cdk bootstrap
   npx cdk deploy --require-approval never
   ```

### ✅ GitHub Actions Setup
1. **Add Repository Secrets** (Settings → Secrets and Variables → Actions):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `GOOGLE_GEMINI_API_KEY`
   - `SENTRY_DSN`

2. **Deploy via GitHub Actions**:
   - Manual: Actions → Deploy → Run workflow
   - Automatic: Push to main branch

## 🌍 Deployment Environments

| Environment | Trigger | URL Pattern | Purpose |
|-------------|---------|-------------|---------|
| Development | Push to main | `*-dev.amazonaws.com` | Development testing |
| Staging | Manual deploy | `*-staging.amazonaws.com` | Pre-production testing |
| Production | Manual deploy | `*-prod.amazonaws.com` | Live production |

## 📊 Monitoring & Health Checks

### Health Check Endpoints
```bash
# Test your deployment
curl https://YOUR-API-ENDPOINT/health
curl https://YOUR-API-ENDPOINT/

# Expected response:
# {"status":"ok","timestamp":"...","environment":"production"}
```

### AWS Resources Created
- **Lambda Function**: API handler
- **API Gateway**: HTTP endpoint
- **S3 Bucket**: Image storage
- **SQS Queue**: Background jobs
- **Cognito User Pool**: Authentication
- **CloudWatch**: Logs and monitoring

## 🔧 Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Add PowerUserAccess policy to your AWS user
   aws iam attach-user-policy --user-name YOUR_USER --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
   ```

2. **CDK Bootstrap Failed**
   ```bash
   # Delete failed stack and retry
   aws cloudformation delete-stack --stack-name CDKToolkit
   npx cdk bootstrap
   ```

3. **Deployment Timeout**
   ```bash
   # Check CloudFormation events
   aws cloudformation describe-stack-events --stack-name aiphoto-prod
   ```

4. **API Not Responding**
   ```bash
   # Check Lambda logs
   aws logs describe-log-groups --log-group-name-prefix /aws/lambda/
   ```

## 🚀 Quick Commands

```bash
# Full deployment from scratch
npx cdk bootstrap && npx cdk deploy --require-approval never

# Update existing deployment
npx cdk deploy --require-approval never

# Destroy everything (careful!)
npx cdk destroy

# View stack outputs
aws cloudformation describe-stacks --stack-name aiphoto-prod --query 'Stacks[0].Outputs'
```

## 🔒 Security Notes

- API keys stored in AWS Parameter Store (encrypted)
- S3 bucket is private (no public access)
- IAM roles follow least privilege principle
- All traffic uses HTTPS
- CORS configured for your domains only

## 📈 Scaling Notes

- Lambda auto-scales (0 to 1000+ concurrent executions)
- API Gateway handles high traffic automatically
- S3 scales infinitely
- SQS queues handle background job spikes
- Cognito scales to millions of users

## 💰 Cost Optimization

- Lambda: Pay per request (very cheap for most workloads)
- API Gateway: ~$3.50 per million requests
- S3: ~$0.023 per GB/month
- Cognito: 50,000 monthly active users free
- Estimated cost: $10-50/month for typical usage

---

**Need Help?** Check the logs, GitHub issues, or AWS CloudWatch for detailed error information.