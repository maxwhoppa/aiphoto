# In-App Purchase Configuration

## iOS (App Store Connect)

### Product ID: `com.dreamboat.premium.photogeneration`
- **Type**: Non-Consumable (or Consumable if users can buy multiple times)
- **Reference Name**: Premium Photo Generation
- **Price**: $99.99 USD
- **Description**: Get 50-60 AI-generated photos across multiple scenarios to enhance your dating profile
- **Display Name**: Premium Photo Package

### Setup Steps:
1. Log in to App Store Connect
2. Go to your app > Features > In-App Purchases
3. Click the + button to add a new product
4. Select "Non-Consumable" or "Consumable" based on your business model
5. Enter Product ID: `com.dreamboat.premium.photogeneration`
6. Fill in the pricing and descriptions
7. Submit for review with your app

## Android (Google Play Console)

### Product ID: `com.dreamboat.premium.photogeneration`
- **Type**: In-app product (managed product)
- **Name**: Premium Photo Package
- **Price**: $99.99 USD
- **Description**: Get 50-60 AI-generated photos across multiple scenarios to enhance your dating profile

### Setup Steps:
1. Log in to Google Play Console
2. Select your app > Monetize > In-app products
3. Click "Create product"
4. Enter Product ID: `com.dreamboat.premium.photogeneration`
5. Fill in the product details and pricing
6. Save and activate the product

## Testing

### iOS Testing:
1. Add test users in App Store Connect (Users and Access > Sandbox Testers)
2. Sign out of your regular Apple ID on device
3. Sign in with sandbox tester account when prompted during purchase

### Android Testing:
1. Add test users in Google Play Console (Setup > License Testing)
2. Upload app to internal testing track
3. Test purchases will not charge real money for licensed testers

## Environment Variables Needed

Add to your server `.env` file:
```
APPLE_SHARED_SECRET=your_apple_shared_secret_here
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY=path_to_service_account_json
```

## Important Notes:
- IAP products must be reviewed and approved before going live
- Test thoroughly in sandbox/test environments before production
- Implement receipt validation on server side for security
- Store purchase records in database for restoration