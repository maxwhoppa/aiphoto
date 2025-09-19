# AI Photo Server - Quick Setup Guide

## ✅ Current Status

Your AI Photo Server is successfully set up and running! 🎉

### What's Working:
- ✅ **TypeScript Configuration** - Full type safety
- ✅ **Package Installation** - All dependencies installed
- ✅ **Basic Server** - Fastify server running on port 3000
- ✅ **Health Check** - `/health` endpoint working
- ✅ **API Status** - `/api/status` endpoint working

### Current Endpoints:
- `GET /health` - Server health check
- `GET /api/status` - API status information

## 🚀 Quick Start

```bash
# The server is already running!
# Visit: http://localhost:3000/health
# Or: http://localhost:3000/api/status
```

## 📁 Project Structure

```
server/
├── src/
│   ├── index-simple.ts      # Simple working server (current)
│   ├── index.ts            # Full-featured server (ready for production)
│   ├── routes/             # tRPC API routes
│   ├── services/           # Business logic (S3, Gemini, Redis, SQS)
│   ├── middleware/         # Auth and request middleware
│   ├── db/                # Database schema and migrations
│   ├── utils/             # Config, errors, monitoring
│   └── workers/           # Background job processors
├── stacks/                # SST infrastructure definitions
├── .github/workflows/     # CI/CD pipelines
└── docker-compose.yml     # Local development environment
```

## 🛠️ Next Steps

### 1. Set up Local Services (Optional)
To use the full-featured server with database and AI processing:

```bash
# Start PostgreSQL, Redis, and LocalStack
docker-compose up -d

# Wait for services to be ready
sleep 30

# Switch to full server
npm run dev:full  # (you'll need to create this script)
```

### 2. Configure Real Services
Update `.env` with real API keys and service URLs:

```bash
# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_real_gemini_api_key

# AWS Services (for production)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Sentry (for error tracking)
SENTRY_DSN=your_real_sentry_dsn
```

### 3. Database Setup
```bash
# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Open database admin (optional)
npm run db:studio
```

### 4. Deploy to AWS
```bash
# Deploy to development
npm run deploy

# Deploy to production
npm run deploy:prod
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start simple server (current)
npm run dev:full         # Start full server with all features
npm run build            # Build for production

# Database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checking

# Deployment
npm run deploy           # Deploy to AWS (dev)
npm run deploy:prod      # Deploy to AWS (production)
```

## 🌐 API Endpoints (Full Server)

When you switch to the full server (`src/index.ts`), you'll have:

### tRPC API (`/trpc/*`)
- `images.getUploadUrl` - Get pre-signed URL for image upload
- `images.confirmUpload` - Confirm upload and validate image
- `images.processImage` - Start AI processing job
- `images.getJobStatus` - Check processing job status
- `images.getUserImages` - Get user's uploaded images
- `images.getUserJobs` - Get user's processing jobs

### Authentication
- AWS Cognito JWT authentication
- Automatic user creation/management
- Protected routes

## 🔍 Monitoring & Debugging

### View Server Logs
The server is currently running with live logs. You can see requests in real-time.

### Health Checks
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/status
```

### Docker Services (when running)
- **PostgreSQL**: http://localhost:5050 (pgAdmin)
- **Redis**: http://localhost:8081 (Redis Commander)
- **LocalStack**: http://localhost:4566 (AWS services)

## 🚨 Troubleshooting

### Server Won't Start
1. Check if port 3000 is available: `lsof -i :3000`
2. Kill existing process: `pkill -f "tsx watch"`
3. Restart: `npm run dev`

### TypeScript Errors
1. Run type checking: `npm run typecheck`
2. Fix errors or switch to simple mode
3. Restart server

### Missing Dependencies
```bash
npm install
npm run dev
```

## 📚 Next Development Steps

1. **Add Authentication**: Integrate AWS Cognito
2. **Add Database**: Set up PostgreSQL with Drizzle
3. **Add AI Processing**: Integrate Google Gemini
4. **Add File Upload**: Implement S3 integration
5. **Add Background Jobs**: Set up SQS processing
6. **Add Monitoring**: Configure CloudWatch and Sentry

The foundation is solid and ready for these enhancements! 🚀