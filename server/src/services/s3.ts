import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ValidationError } from '@/utils/errors';

const s3Client = new S3Client({
  region: config.AWS_REGION,
});

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadPresignedUrlRequest {
  fileName: string;
  contentType: string;
  userId: string;
}

export interface UploadPresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface DownloadPresignedUrlRequest {
  s3Key: string;
  expiresIn?: number;
}

export class S3Service {
  private bucketName: string;

  constructor() {
    this.bucketName = config.S3_BUCKET_NAME;
  }

  validateImageFile(contentType: string, fileName: string): void {
    if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
      throw new ValidationError(
        `Unsupported file type: ${contentType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    const ext = path.extname(fileName).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    
    if (!allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Unsupported file extension: ${ext}. Allowed extensions: ${allowedExtensions.join(', ')}`
      );
    }
  }

  generateS3Key(userId: string, fileName: string, prefix: string = 'uploads'): string {
    const fileId = uuidv4();
    const ext = path.extname(fileName);
    const timestamp = Date.now();
    return `${prefix}/${userId}/${timestamp}_${fileId}${ext}`;
  }

  async createUploadPresignedUrl({
    fileName,
    contentType,
    userId,
  }: UploadPresignedUrlRequest): Promise<UploadPresignedUrlResponse> {
    try {
      this.validateImageFile(contentType, fileName);

      const s3Key = this.generateS3Key(userId, fileName);
      const expiresIn = 15 * 60; // 15 minutes

      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: contentType,
        Metadata: {
          userId,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn,
      });

      logger.info('Created upload presigned URL', {
        userId,
        s3Key,
        fileName,
        contentType,
      });

      return {
        uploadUrl,
        s3Key,
        expiresIn,
      };
    } catch (error) {
      logger.error('Failed to create upload presigned URL', {
        error,
        userId,
        fileName,
        contentType,
      });
      throw error;
    }
  }

  async createDownloadPresignedUrl({
    s3Key,
    expiresIn = 60 * 60, // 1 hour default
  }: DownloadPresignedUrlRequest): Promise<string> {
    try {
      // Verify object exists
      await this.headObject(s3Key);

      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const downloadUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn,
      });

      logger.debug('Created download presigned URL', {
        s3Key,
        expiresIn,
      });

      return downloadUrl;
    } catch (error) {
      logger.error('Failed to create download presigned URL', {
        error,
        s3Key,
      });
      throw error;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    s3Key: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<void> {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await s3Client.send(putCommand);

      logger.info('Buffer uploaded to S3', {
        s3Key,
        contentType,
        size: buffer.length,
      });
    } catch (error) {
      logger.error('Failed to upload buffer to S3', {
        error,
        s3Key,
        contentType,
      });
      throw error;
    }
  }

  async downloadBuffer(s3Key: string): Promise<Buffer> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await s3Client.send(getCommand);
      
      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      const buffer = Buffer.from(await response.Body.transformToByteArray());

      logger.debug('Buffer downloaded from S3', {
        s3Key,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download buffer from S3', {
        error,
        s3Key,
      });
      throw error;
    }
  }

  async deleteObject(s3Key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await s3Client.send(deleteCommand);

      logger.info('Object deleted from S3', { s3Key });
    } catch (error) {
      logger.error('Failed to delete object from S3', {
        error,
        s3Key,
      });
      throw error;
    }
  }

  async headObject(s3Key: string): Promise<boolean> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await s3Client.send(headCommand);
      return true;
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  getPublicUrl(s3Key: string): string {
    return `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${s3Key}`;
  }
}

export const s3Service = new S3Service();