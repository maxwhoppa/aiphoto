# AI Photo Server

A production-ready serverless backend for AI photo processing using Google Gemini, built with TypeScript, tRPC, and AWS serverless infrastructure.

## 🚀 Features

- **Type-safe API** with tRPC and Zod validation
- **Serverless architecture** using AWS Lambda, API Gateway, and SST
- **AI image processing** with Google Gemini Vision API
- **Secure authentication** with AWS Cognito JWT
- **File storage** with S3 and pre-signed URLs
- **Background job processing** with SQS and Lambda workers
- **Caching** with Redis for performance
- **Real-time monitoring** with CloudWatch, X-Ray, and Sentry
- **Production-ready** with comprehensive error handling and logging

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Mobile App    │───▶│  API Gateway │───▶│   Lambda API    │
│   (Expo/RN)     │    │   (tRPC)     │    │   (Fastify)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                         ┌─────────────────────────────┼─────────────────────────────┐
                         ▼                             ▼                             ▼
                ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
                │   PostgreSQL    │          │      Redis      │          │       S3        │
                │   (Database)    │          │    (Cache)      │          │   (Storage)     │
                └─────────────────┘          └─────────────────┘          └─────────────────┘
                                                     │
                         ┌─────────────────────────────┼─────────────────────────────┐
                         ▼                             ▼                             ▼
                ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
                │      SQS        │          │  Lambda Worker  │          │  Google Gemini  │
                │   (Job Queue)   │          │ (Image Process) │          │   (AI Vision)   │
                └─────────────────┘          └─────────────────┘          └─────────────────┘
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18 with TypeScript
- **API**: tRPC over HTTP with Fastify
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis with ioredis
- **Storage**: AWS S3 with pre-signed URLs
- **Queue**: AWS SQS for background jobs
- **Auth**: AWS Cognito JWT
- **AI**: Google Gemini Vision API
- **Infrastructure**: AWS Lambda + SST (Serverless Stack)
- **Monitoring**: CloudWatch, X-Ray, Sentry
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Node.js 18+
- Docker and Docker Compose
- AWS CLI configured
- Google Cloud account with Gemini API access

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd server
npm install
```

### 2. Set up Local Development

```bash
# Copy environment template
cp .env.local .env

# Start local services
docker-compose up -d

# Wait for services to be ready
sleep 30

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### 3. Environment Configuration

Update `.env` with your actual values:

```bash
# Google Gemini
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# AWS Cognito (for production)
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

## 📚 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run db:generate      # Generate database migrations
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Drizzle Studio

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run typecheck        # Run TypeScript type checking

# Building
npm run build            # Build for production

# Deployment
npm run deploy           # Deploy to dev stage
npm run deploy:prod      # Deploy to production
```

## 🐳 Local Development with Docker

The project includes a complete Docker Compose setup:

```bash
# Start all services
docker-compose up -d

# Services included:
# - PostgreSQL (port 5432)
# - Redis (port 6379)
# - LocalStack (AWS services, port 4566)
# - pgAdmin (port 5050)
# - Redis Commander (port 8081)
```

### Service URLs:
- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **pgAdmin**: http://localhost:5050 (admin@aiphoto.com / admin)
- **Redis Commander**: http://localhost:8081
- **LocalStack Dashboard**: http://localhost:4566

## 🚀 Deployment

### Deploy to AWS

1. **Configure AWS credentials**:
```bash
aws configure
```

2. **Deploy to development**:
```bash
npm run deploy
```

3. **Deploy to production**:
```bash
npm run deploy:prod
```

### Environment Stages

- **dev**: Development environment (default)
- **staging**: Staging environment for testing
- **prod**: Production environment

## 📖 API Documentation

The API uses tRPC for type-safe communication. Main endpoints:

### Images Router (`/trpc/images.*`)

- `getUploadUrl` - Get pre-signed URL for image upload
- `confirmUpload` - Confirm upload and validate image
- `processImage` - Start AI processing job
- `getJobStatus` - Check processing job status
- `getUserImages` - Get user's uploaded images
- `getUserJobs` - Get user's processing jobs

### Example Usage

```typescript
// Upload image
const { uploadUrl, s3Key } = await trpc.images.getUploadUrl.mutate({
  fileName: 'photo.jpg',
  contentType: 'image/jpeg'
});

// Upload to S3 using uploadUrl
// ...

// Confirm upload
const { imageId, suggestions } = await trpc.images.confirmUpload.mutate({
  s3Key,
  fileName: 'photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: '1024000'
});

// Process image
const { jobId } = await trpc.images.processImage.mutate({
  imageId,
  prompt: 'Professional business portrait in modern office setting'
});

// Check status
const status = await trpc.images.getJobStatus.query({ jobId });
```

## 🔒 Security

- JWT authentication with AWS Cognito
- Input validation with Zod schemas
- Rate limiting for API endpoints
- Content validation for uploaded images
- Secure file upload with pre-signed URLs
- Proper error handling without information leakage

## 📊 Monitoring

### CloudWatch Metrics
- API request counts and latency
- Image processing success/failure rates
- Queue depth and processing times

### X-Ray Tracing
- End-to-end request tracing
- Performance bottleneck identification
- Service dependency mapping

### Sentry Error Tracking
- Real-time error notifications
- Error grouping and trending
- Performance monitoring

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

## 🔧 Troubleshooting

### Common Issues

1. **Database connection fails**:
   - Ensure PostgreSQL is running: `docker-compose ps`
   - Check DATABASE_URL in .env

2. **Redis connection fails**:
   - Ensure Redis is running: `docker-compose ps`
   - Check REDIS_URL in .env

3. **LocalStack services not working**:
   - Restart LocalStack: `docker-compose restart localstack`
   - Check initialization: `docker-compose logs localstack`

4. **Gemini API errors**:
   - Verify GOOGLE_GEMINI_API_KEY is set correctly
   - Check API quotas and billing in Google Cloud Console

### Logs and Debugging

```bash
# View application logs
npm run dev | bunyan

# View Docker service logs
docker-compose logs -f [service-name]

# Check health status
curl http://localhost:3000/health
```

## 📈 Performance Optimization

- **Caching**: Redis for frequently accessed data
- **Image optimization**: Sharp for image processing
- **Connection pooling**: Optimized database connections
- **Rate limiting**: Prevent abuse and ensure fair usage
- **Lazy loading**: Database connections and external services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@aiphoto.com
- 📚 Documentation: [Internal Wiki](link)
- 🐛 Bug Reports: [GitHub Issues](link)
- 💬 Discussions: [GitHub Discussions](link)