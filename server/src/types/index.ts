import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  cognitoId: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ImageProcessingJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  originalImageUrl: z.string().url(),
  prompt: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  processedImageUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UploadImageSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  prompt: z.string().min(1).max(1000),
});

export const ProcessImageRequestSchema = z.object({
  imageId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
});

export type User = z.infer<typeof UserSchema>;
export type ImageProcessingJob = z.infer<typeof ImageProcessingJobSchema>;
export type UploadImageRequest = z.infer<typeof UploadImageSchema>;
export type ProcessImageRequest = z.infer<typeof ProcessImageRequestSchema>;

export interface AuthContext {
  userId: string;
  cognitoId: string;
  email: string;
}