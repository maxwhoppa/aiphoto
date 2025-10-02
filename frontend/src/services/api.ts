// API service for the DreamBoat AI app
import { authHandler, apiRequest, apiRequestJson } from './authHandler';

// Auth API calls (public - no authentication required)
export async function confirmSocialUser(email: string, provider: 'apple' | 'google') {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}/trpc/auth.confirmSocialUser`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      provider,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to confirm social user: ${response.status} ${errorText}`);
  }

  return response.json();
}

// Payment API calls
export async function createCheckoutSession() {
  return apiRequestJson('/trpc/payments.getOrCreateCheckout', {
    method: 'POST',
    body: JSON.stringify({
      json: {}, // TRPC mutation format
    }),
  });
}

export async function checkPaymentAccess() {
  return apiRequestJson('/trpc/payments.checkAccess');
}

export async function redeemPayment(paymentId: string) {
  return apiRequestJson('/trpc/payments.redeemPayment', {
    method: 'POST',
    body: JSON.stringify({
      json: { paymentId }, // TRPC mutation format
    }),
  });
}

export async function getPaymentHistory() {
  return apiRequestJson('/trpc/payments.getPaymentHistory');
}

// Image API calls
export async function getUploadUrls(files: Array<{fileName: string; contentType: string; sizeBytes: number}>) {
  console.log('getUploadUrls called with files:', files);
  
  // Use exact format from example - no "json" wrapper
  const requestBody = { files };
  
  console.log('Request body to send:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await apiRequestJson('/trpc/images.getUploadUrls', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('Upload URLs response:', response);
    return response;
  } catch (error) {
    console.error('getUploadUrls error:', error);
    throw error;
  }
}

export async function recordUploadedImages(images: Array<{fileName: string; contentType: string; sizeBytes: number; s3Key: string; s3Url: string}>) {
  console.log('recordUploadedImages called with images:', images);
  
  // Use exact format from example - no "json" wrapper
  const requestBody = { images };
  
  console.log('Request body to send:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await apiRequestJson('/trpc/images.recordUploadedImages', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('Record images response:', response);
    return response;
  } catch (error) {
    console.error('recordUploadedImages error:', error);
    throw error;
  }
}

export async function generateImages(imageIds: string[], scenarios: string[]) {
  console.log('generateImages called with:', { imageIds, scenarios });
  
  // Use direct format - no "json" wrapper
  const requestBody = { imageIds, scenarios };
  
  console.log('Request body to send:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await apiRequestJson('/trpc/images.generateImages', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('Generate images response:', response);
    return response;
  } catch (error) {
    console.error('generateImages error:', error);
    throw error;
  }
}

export async function getGeneratedImages(filters = {}) {
  const queryString = Object.keys(filters).length > 0 
    ? '?input=' + encodeURIComponent(JSON.stringify(filters))
    : '?input={}';
  
  return apiRequestJson('/trpc/images.getGeneratedImages' + queryString);
}

export async function getMyImages() {
  return apiRequestJson('/trpc/images.getMyImages');
}

// Photo API calls
export async function getProfile() {
  const response = await authHandler.makeAuthenticatedRequest('/api/profile');
  
  if (!response.ok) {
    throw new Error(`Failed to get profile: ${response.status}`);
  }
  
  return response.json();
}

// Method 2: Using the helper functions for cleaner code
export async function uploadPhoto(photoData: FormData) {
  const response = await apiRequest('/api/photos/upload', {
    method: 'POST',
    body: photoData,
    headers: {
      // Don't set Content-Type for FormData, let the browser set it
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload photo: ${response.status}`);
  }
  
  return response.json();
}

// Method 3: Using the JSON helper for automatic JSON parsing
export async function getGeneratedPhotos(): Promise<any[]> {
  return apiRequestJson('/api/photos/generated');
}

export async function generatePhotos(scenarioId: string) {
  return apiRequestJson('/api/photos/generate', {
    method: 'POST',
    body: JSON.stringify({ scenarioId }),
  });
}

// Method 4: Using through AuthContext (in components)
/*
export function useApiCalls() {
  const { makeAuthenticatedRequest } = useAuth();
  
  const getUserPhotos = async () => {
    const response = await makeAuthenticatedRequest('/api/photos');
    return response.json();
  };
  
  return { getUserPhotos };
}
*/

// All these methods will:
// 1. Automatically include the Authorization header with a valid access token
// 2. Refresh the token if it's expired before making the request
// 3. Retry the request with the new token if it gets a 401 response
// 4. Handle token refresh failures gracefully