# AI Photo Dating Profile Generator

## Project Overview

This is a mobile application built with Expo that allows users to upload photos of themselves and receive AI-generated photos in different scenarios to curate their dating profiles. The app uses Google Gemini for AI photo generation and implements a freemium model with a $99.99 paywall.

## Architecture

The project is split into two main directories:
- `frontend/` - Expo React Native app
- `server/` - Backend API server

### Frontend (Expo React Native)
- User interface for photo upload and scenario selection
- Payment integration for premium features
- Photo gallery and curation tools
- Responsive design for mobile devices

### Server (Node.js/Express)
- API endpoints for photo upload and processing
- Integration with Google Gemini for AI photo generation
- Payment processing
- User management and photo storage

## User Flow

1. **Landing Page** - Introduction and app benefits pitch
2. **Photo Upload** - Users upload photos of themselves
3. **Scenario Selection** - Choose from photoshoot, nature, gym, beach, rooftop, etc.
4. **Loading Screen** - Progress updates with additional pitch content
5. **Paywall** - $99.99 payment prompt to access full-resolution photos using stripe webview
6. **Photo Curation** - Review and select favorite photos by scenario (50-60 total)
7. **Final Gallery** - Curated collection of selected photos, within the final gallery a user can instigate a second round for another 1x payment

## Technical Requirements

### Frontend Dependencies
```bash
# Core Expo/React Native
expo
react-native
@expo/vector-icons

# Navigation
@react-navigation/native
@react-navigation/stack

# Image handling
expo-image-picker
expo-media-library

# Payments
expo-in-app-purchases

# UI Components
react-native-elements
react-native-vector-icons

# State management
@reduxjs/toolkit
react-redux
```

### Server Dependencies
```bash
# Core server
express
cors
helmet
dotenv

# Google Gemini integration
@google/generative-ai

# File handling
multer
sharp

# Payment processing
stripe

# Database
mongoose
mongodb
```

## Development Commands

### Frontend
```bash
cd frontend
npm install
npm start              # Start Expo development server
npm run android        # Run on Android
npm run ios           # Run on iOS
npm run web           # Run on web
```

### Server
```bash
cd server
npm install
npm run dev           # Start development server with nodemon
npm start             # Start production server
npm run test          # Run tests
```

## Environment Variables

### Frontend (.env)
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Server (.env)
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/aiphoto
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your_jwt_secret
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Photos
- `POST /api/photos/upload` - Upload user photos
- `POST /api/photos/generate` - Generate AI photos
- `GET /api/photos/user/:userId` - Get user's photos
- `PUT /api/photos/:photoId/favorite` - Mark photo as favorite

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment
- `POST /api/payments/webhook` - Handle Stripe webhooks

### Scenarios
- `GET /api/scenarios` - Get available photo scenarios

## Project Structure

```
aiphoto/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── navigation/
│   │   ├── store/
│   │   └── utils/
│   ├── assets/
│   ├── App.js
│   └── package.json
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── server.js
│   └── package.json
├── CLAUDE.md
└── README.md
```

## Key Features to Implement

### Photo Processing Pipeline
1. User photo upload validation
2. Google Gemini API integration for style transfer
3. Batch generation of 50-60 photos across scenarios
4. Image optimization and watermarking for previews

### Payment Integration
1. Stripe payment processing
2. In-app purchase validation
3. User subscription management
4. Access control for premium features

### User Experience
1. Smooth loading animations
2. Progress tracking during generation
3. Intuitive photo selection interface
4. Responsive mobile design

## Testing Strategy

### Frontend Testing
- Unit tests for components using Jest and React Native Testing Library
- Integration tests for navigation flows
- E2E tests using Detox

### Server Testing
- Unit tests for API endpoints using Jest and Supertest
- Integration tests for Gemini API
- Payment processing tests with Stripe test mode

## Deployment

### Frontend
- Build and deploy to Expo Application Services (EAS)
- Configure app store submissions for iOS and Android

### Server
- Deploy to cloud platform (AWS, Google Cloud, or Heroku)
- Set up MongoDB Atlas for production database
- Configure environment variables and secrets

## Security Considerations

- Input validation for photo uploads
- Rate limiting for API endpoints
- Secure storage of API keys and payment information
- User data encryption and privacy compliance