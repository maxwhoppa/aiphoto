import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export interface PresignedUploadUrl {
  uploadUrl: string;
  s3Key: string;
  s3Url: string;
  expiresIn: number;
}

export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresIn: number;
}

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: config.AWS_REGION,
      credentials: config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      } : undefined, // Use default credentials if not provided
    });
    
    this.bucketName = config.S3_BUCKET_NAME;
    
    logger.info('S3 service initialized', {
      region: config.AWS_REGION,
      bucket: this.bucketName,
    });
  }

  async generateUploadUrl(
    userId: string,
    fileName: string,
    contentType: string,
    expiresInSeconds: number = 3600 // 1 hour default
  ): Promise<PresignedUploadUrl> {
    try {
      // Create a unique S3 key
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `users/${userId}/originals/${timestamp}-${sanitizedFileName}`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      const s3Url = `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${s3Key}`;

      logger.info('Generated S3 upload URL', {
        userId,
        s3Key,
        contentType,
        expiresIn: expiresInSeconds,
      });

      return {
        uploadUrl,
        s3Key,
        s3Url,
        expiresIn: expiresInSeconds,
      };
    } catch (error) {
      logger.error('Failed to generate S3 upload URL', {
        userId,
        fileName,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('Failed to generate upload URL');
    }
  }

  async generateDownloadUrl(
    s3Key: string,
    expiresInSeconds: number = 3600 // 1 hour default
  ): Promise<PresignedDownloadUrl> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      logger.info('Generated S3 download URL', {
        s3Key,
        expiresIn: expiresInSeconds,
      });

      return {
        downloadUrl,
        expiresIn: expiresInSeconds,
      };
    } catch (error) {
      logger.error('Failed to generate S3 download URL', {
        s3Key,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('Failed to generate download URL');
    }
  }

  async generateGeneratedImageUploadUrl(
    userId: string,
    originalImageId: string,
    scenario: string,
    expiresInSeconds: number = 3600
  ): Promise<PresignedUploadUrl> {
    try {
      const timestamp = Date.now();
      const s3Key = `users/${userId}/generated/${originalImageId}/${scenario}/${timestamp}.jpg`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: 'image/jpeg',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      const s3Url = `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${s3Key}`;

      logger.info('Generated S3 upload URL for generated image', {
        userId,
        originalImageId,
        scenario,
        s3Key,
      });

      return {
        uploadUrl,
        s3Key,
        s3Url,
        expiresIn: expiresInSeconds,
      };
    } catch (error) {
      logger.error('Failed to generate S3 upload URL for generated image', {
        userId,
        originalImageId,
        scenario,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('Failed to generate upload URL for generated image');
    }
  }

  getPublicUrl(s3Key: string): string {
    return `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${s3Key}`;
  }

  async checkFileExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      
      logger.debug('S3 file exists', {
        s3Key,
        bucket: this.bucketName,
      });

      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        logger.debug('S3 file not found', {
          s3Key,
          bucket: this.bucketName,
        });
        return false;
      }
      
      logger.error('Failed to check S3 file existence', {
        s3Key,
        bucket: this.bucketName,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}

export const s3Service = new S3Service();
export default s3Service;