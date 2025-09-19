// Mirror types from server for better type safety
export interface UploadPresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  fields: Record<string, string>;
}

export interface ConfirmUploadResponse {
  imageId: string;
  suggestions: string[];
}

export interface ProcessImageResponse {
  jobId: string;
  status: 'queued';
}

export interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: {
    processedImageUrl?: string;
    errorMessage?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  updatedAt: string;
}

export interface UserImage {
  id: string;
  userId: string;
  originalFileName: string;
  s3Key: string;
  s3Url: string;
  contentType: string;
  sizeBytes: string;
  createdAt: Date;
  updatedAt: Date;
  downloadUrl: string;
}

export interface ProcessingJob {
  id: string;
  userId: string;
  originalImageUrl: string;
  processedImageUrl?: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  processedImageDownloadUrl?: string;
}