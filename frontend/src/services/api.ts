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
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/payments.checkAccess?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
}

export async function checkGenerationStatus() {
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/payments.checkGenerationStatus?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
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
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/payments.getPaymentHistory?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
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

export async function generateImages(imageIds: string[], scenarios: string[], paymentId?: string) {
  console.log('generateImages called with:', { imageIds, scenarios, paymentId });

  // Use direct format - no "json" wrapper
  const requestBody: any = { imageIds, scenarios };
  if (paymentId) {
    requestBody.paymentId = paymentId;
  }

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
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/images.getMyImages?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
}

// Selected profile photos API calls
export async function setSelectedProfilePhotos(selections: Array<{generatedImageId: string; order: number}>) {
  console.log('setSelectedProfilePhotos called with:', selections);

  const requestBody = { selections };

  try {
    const response = await apiRequestJson('/trpc/images.setSelectedProfilePhotos', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Set selected photos response:', response);
    return response;
  } catch (error) {
    console.error('setSelectedProfilePhotos error:', error);
    throw error;
  }
}

export async function getSelectedProfilePhotos() {
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/images.getSelectedProfilePhotos?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
}

export async function toggleProfilePhotoSelection(generatedImageId: string, order?: number) {
  console.log('toggleProfilePhotoSelection called with:', { generatedImageId, order });

  const requestBody = { generatedImageId, order };

  try {
    const response = await apiRequestJson('/trpc/images.toggleProfilePhotoSelection', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Toggle selection response:', response);
    return response;
  } catch (error) {
    console.error('toggleProfilePhotoSelection error:', error);
    throw error;
  }
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

// User API calls
export async function getUserInfo() {
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/user.getUserInfo?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
}

export async function updatePhoneNumber(phoneNumber: string) {
  console.log('updatePhoneNumber called with:', phoneNumber);

  const requestBody = { phoneNumber };

  try {
    const response = await apiRequestJson('/trpc/user.updatePhoneNumber', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Update phone number response:', response);
    return response;
  } catch (error) {
    console.error('updatePhoneNumber error:', error);
    throw error;
  }
}

// Photo Validation API calls
export interface ValidationResult {
  imageId: string;
  isValid: boolean;
  warnings: ('multiple_people' | 'face_covered_or_blurred' | 'poor_lighting')[];
  details: {
    multiplePeople: boolean;
    faceCoveredOrBlurred: boolean;
    poorLighting: boolean;
  };
}

export interface ValidationResponse {
  results: ValidationResult[];
  allValid: boolean;
  validCount: number;
  imagesWithWarnings: string[];
}

export async function validateImages(imageIds: string[]): Promise<ValidationResponse> {
  console.log('validateImages called with:', imageIds);

  const requestBody = { imageIds };

  try {
    const response = await apiRequestJson('/trpc/images.validateImages', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Validate images response:', response);
    return response;
  } catch (error) {
    console.error('validateImages error:', error);
    throw error;
  }
}

export async function bypassValidation(imageIds: string[]) {
  console.log('bypassValidation called with:', imageIds);

  const requestBody = { imageIds };

  try {
    const response = await apiRequestJson('/trpc/images.bypassValidation', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Bypass validation response:', response);
    return response;
  } catch (error) {
    console.error('bypassValidation error:', error);
    throw error;
  }
}

export async function getImageRepository() {
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/images.getImageRepository?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0];
}

export async function replaceImage(oldImageId: string, newImage: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  s3Url: string;
}) {
  console.log('replaceImage called with:', { oldImageId, newImage });

  const requestBody = { oldImageId, newImage };

  try {
    const response = await apiRequestJson('/trpc/images.replaceImage', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Replace image response:', response);
    return response;
  } catch (error) {
    console.error('replaceImage error:', error);
    throw error;
  }
}

// Sample Photo API calls
export interface SamplePhotoImage {
  id: string;
  scenario: string;
  downloadUrl: string | null;
  s3Key: string;
  s3Url: string;
}

export interface SamplePhotosResponse {
  success: boolean;
  alreadyExists?: boolean;
  sampleImages?: SamplePhotoImage[];
  failedCount?: number;
  error?: string;
}

export async function generateSamplePhotos(imageIds: string[]): Promise<SamplePhotosResponse> {
  console.log('generateSamplePhotos called with:', imageIds);

  const requestBody = { imageIds };

  try {
    const response = await apiRequestJson('/trpc/images.generateSamplePhotos', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log('Generate sample photos response:', response);
    return response?.result?.data || response;
  } catch (error) {
    console.error('generateSamplePhotos error:', error);
    throw error;
  }
}

export async function getSamplePhotos(): Promise<SamplePhotoImage[]> {
  // tRPC queries need to be called with batch format
  const params = new URLSearchParams({
    batch: '1',
    input: JSON.stringify({ '0': {} })
  });
  const response = await apiRequestJson(`/trpc/images.getSamplePhotos?${params}`);
  // Extract from batch response format
  return response[0]?.result?.data || response[0] || [];
}

// All these methods will:
// 1. Automatically include the Authorization header with a valid access token
// 2. Refresh the token if it's expired before making the request
// 3. Retry the request with the new token if it gets a 401 response
// 4. Handle token refresh failures gracefully