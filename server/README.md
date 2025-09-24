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

- Node.js 18+
- PostgreSQL database
- Redis (optional)
- AWS account with Cognito, RDS, and S3
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

#### Users
- `users.me` - Get current user profile
- `users.updateProfile` - Update user profile
- `users.getMyImages` - Get user's images
- `users.deleteAccount` - Delete user account

#### Admin Users
- `users.getAllUsers` - Get all users (admin only)
- `users.toggleUserStatus` - Toggle user active status (admin only)
- `users.updateUserRole` - Update user role (admin only)

#### Images
- `images.uploadImage` - Upload new image
- `images.generateImages` - Generate AI images with Gemini
- `images.getProcessingJobs` - Get processing job status
- `images.getJob` - Get specific job details
- `images.deleteImage` - Delete image
- `images.getScenarios` - Get available scenarios

#### Admin Images
- `images.getAllJobs` - Get all processing jobs (admin only)

#### Health
- `health.check` - Public health check
- `health.detailed` - Detailed health check (admin only)

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables:

- `users` - User accounts linked to Cognito
- `user_images` - Uploaded images
- `image_processing_jobs` - AI processing job queue
- `scenarios` - Available image scenarios

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

The repository includes automated deployment workflows:

- **Staging**: Deploys on push to `main` branch
- **Production**: Deploys on push to `production` branch

#### Required GitHub Secrets

**Staging Environment:**
- `STAGING_HOST` - EC2 instance hostname
- `STAGING_USERNAME` - SSH username
- `STAGING_SSH_KEY` - SSH private key
- `STAGING_SSH_PORT` - SSH port (default: 22)

**Production Environment:**
- `PRODUCTION_HOST` - EC2 instance hostname
- `PRODUCTION_USERNAME` - SSH username
- `PRODUCTION_SSH_KEY` - SSH private key
- `PRODUCTION_SSH_PORT` - SSH port (default: 22)

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend      │────│   Nginx      │────│   Express       │
│   (React/RN)    │    │   (Proxy)    │    │   + tRPC        │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                    ┌─────────▼────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
                    │   PostgreSQL     │   │   Redis         │   │   AWS Services    │
                    │   (User/Image    │   │   (Cache)       │   │   - Cognito       │
                    │    Data)         │   │                 │   │   - S3            │
                    └──────────────────┘   └─────────────────┘   │   - SQS           │
                                                                 └───────────────────┘
                                           
                                           ┌───────────────────┐
                                           │   Google Gemini   │
                                           │   (AI Processing) │
                                           └───────────────────┘
```

## Security Features

- JWT token validation with Cognito
- Request validation with Zod
- Rate limiting and CORS protection
- Helmet.js security headers
- Input sanitization
- Error handling and logging

## Monitoring and Logging

- Winston logging with structured output
- Health check endpoints
- Error tracking and monitoring
- Performance metrics

## License

MIT