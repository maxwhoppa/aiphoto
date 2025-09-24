# AI Photo Express tRPC Server

A production-ready Express server with tRPC that handles AI photo processing using Google Gemini, AWS Cognito authentication, and RDS database integration.

## Features

- **Express + tRPC**: Type-safe API with automatic validation
- **AWS Cognito**: Authentication and user management
- **Google Gemini**: AI-powered image processing
- **PostgreSQL**: Database with Drizzle ORM
- **Redis**: Caching and session management
- **AWS S3**: Image storage
- **EC2 Deployment**: Production-ready deployment scripts
- **GitHub Actions**: Automated CI/CD pipeline

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL database
- Redis (optional)
- AWS account with Cognito, RDS, S3, and SQS
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration

5. Run database migrations:
   ```bash
   npm run db:migrate
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for all required environment variables.

## API Endpoints

### Health Check
- `GET /health` - Public health check

### tRPC Endpoints
- `/trpc` - Protected tRPC endpoints (requires authentication)
- `/trpc/health.check` - Public health check via tRPC

### Available Procedures

#### Images
- `images.getUploadUrls` - Get presigned S3 upload URLs for user images
- `images.recordUploadedImages` - Record uploaded images in database after S3 upload
- `images.generateImages` - Generate AI images with Gemini for multiple scenarios
- `images.getGeneratedImages` - Get user's generated images with optional filtering
- `images.getGeneratedImage` - Get specific generated image by ID
- `images.getMyImages` - Get user's original uploaded images
- `images.deleteImage` - Delete original uploaded image
- `images.deleteGeneratedImage` - Delete generated image
- `images.getScenarios` - Get available image generation scenarios

#### Health
- `health.check` - Public health check

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables:

- `users` - User accounts linked to AWS Cognito (id, cognitoId, email)
- `user_images` - Original uploaded images (userId, originalFileName, s3Key, s3Url, contentType, sizeBytes)
- `generated_images` - AI-generated images (userId, originalImageId, scenario, prompt, s3Key, s3Url, geminiRequestId)
- `scenarios` - Available image generation scenarios (name, description, prompt, isActive, sortOrder)

## Deployment

### Local Development with Docker

```bash
docker-compose up -d
```

### EC2 Deployment

1. Run the EC2 setup script on your instance:
   ```bash
   chmod +x scripts/setup-ec2.sh
   ./scripts/setup-ec2.sh
   ```

2. Configure your environment variables in `/opt/aiphoto-server/.env`

3. Deploy using GitHub Actions or manually:
   ```bash
   # Manual deployment
   npm run build
   # Copy dist/, package.json, package-lock.json to server
   # Install dependencies and start service
   ```

### GitHub Actions CI/CD

The repository includes automated deployment using CloudFormation and CodeDeploy:

- **Production**: Deploys on push to `main` or `production` branch
- Uses AWS CloudFormation for infrastructure provisioning
- Uses AWS CodeDeploy for application deployment
- Automatically creates S3 buckets and EC2 key pairs if needed

#### Required GitHub Secrets

**Required Secrets:**
- `AWS_ACCESS_KEY_ID` - AWS access key for CloudFormation and CodeDeploy
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `GOOGLE_GEMINI_API_KEY` - Google Gemini API key for AI processing

**Optional Secrets (with defaults):**
- `DATABASE_URL` - PostgreSQL connection string (defaults to localhost)
- `REDIS_URL` - Redis connection string (defaults to localhost)
- `COGNITO_USER_POOL_ID` - AWS Cognito User Pool ID (defaults to us-east-1_vT51duDCY)
- `COGNITO_REGION` - AWS Cognito region (defaults to us-east-1)
- `S3_BUCKET_NAME` - S3 bucket for image storage (defaults to aiphoto-images-dev)
- `CORS_ORIGIN` - Allowed CORS origins (defaults to localhost URLs)
- `KEY_PAIR_NAME` - EC2 key pair name (defaults to aiphoto-production)

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run db:generate` - Generate database migrations with drizzle-kit
- `npm run db:migrate` - Run database migrations with tsx
- `npm run db:studio` - Open Drizzle Studio for database management

## Architecture

```
┌─────────────────┐                         ┌─────────────────┐
│   Frontend      │─────────────────────────│   Express       │
│   (Expo/RN)     │                         │   + tRPC        │
└─────────────────┘                         └─────────────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                    ┌─────────▼────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
                    │   PostgreSQL     │   │   Redis         │   │   AWS Cognito     │
                    │   + Drizzle ORM  │   │   (Cache)       │   │   (Auth/Users)    │
                    │                  │   │                 │   │                   │
                    │   - users        │   │                 │   └───────────────────┘
                    │   - user_images  │   │                 │             │
                    │   - generated_   │   │                 │             │
                    │     images       │   │                 │   ┌─────────▼─────────┐
                    │   - scenarios    │   │                 │   │   AWS S3          │
                    └──────────────────┘   └─────────────────┘   │   (Image Storage) │
                                                                 │                   │
                              ┌──────────────────────────────────┤   - Original      │
                              │                                  │     Images        │
                              │                                  │   - Generated     │
                    ┌─────────▼────────┐                         │     Images        │
                    │   Google Gemini  │                         └───────────────────┘
                    │   (AI Image      │                                   │
                    │    Generation)   │                                   │
                    │                  │                         ┌─────────▼─────────┐
                    │   - Style        │                         │   AWS SQS         │
                    │     Transfer     │                         │   (Future:        │
                    │   - Scenario     │                         │    Job Queue)     │
                    │     Processing   │                         └───────────────────┘
                    └──────────────────┘                         
```

## Security Features

- JWT token validation with AWS Cognito
- Request validation with Zod schemas
- CORS protection with configurable origins
- Helmet.js security headers
- S3 file validation for uploads
- Structured error handling and Winston logging

## Monitoring and Logging

- Winston logging with structured output
- Health check endpoints
- Error tracking and monitoring
- Performance metrics

## License

MIT