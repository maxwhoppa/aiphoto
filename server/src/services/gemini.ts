import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { s3Service } from './s3';
import sharp from 'sharp';

const genAI = new GoogleGenerativeAI(config.GOOGLE_GEMINI_API_KEY);

export interface ImageProcessingRequest {
  originalImageS3Key: string;
  prompt: string;
  userId: string;
  jobId: string;
}

export interface ImageProcessingResult {
  processedImageS3Key: string;
  processedImageUrl: string;
  processingTime: number;
  geminiRequestId?: string;
}

export class GeminiService {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-pro-vision',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Optimize image for Gemini processing
      const processedBuffer = await sharp(buffer)
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 85,
          progressive: true 
        })
        .toBuffer();

      logger.debug('Image preprocessed', {
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
      });

      return processedBuffer;
    } catch (error) {
      logger.error('Image preprocessing failed', { error });
      throw new Error('Failed to preprocess image');
    }
  }

  private buildPrompt(userPrompt: string): string {
    const basePrompt = `
You are an expert AI photo editor specializing in creating high-quality, professional images for dating profiles. 

The user has provided the following scenario request: "${userPrompt}"

Please analyze the input image and generate a new, enhanced version that:
1. Maintains the person's facial features and identity
2. Implements the requested scenario naturally and believably
3. Ensures professional photo quality with good lighting and composition
4. Keeps the person as the main focus
5. Creates an attractive, authentic-looking result suitable for dating profiles

Important guidelines:
- Preserve the person's unique facial characteristics
- Ensure natural lighting and realistic shadows
- Maintain high image quality and resolution
- Create a believable, non-artificial looking result
- Follow the scenario while keeping it tasteful and appropriate

Generate the enhanced image following these specifications.
    `;

    return basePrompt.trim();
  }

  async processImage({
    originalImageS3Key,
    prompt,
    userId,
    jobId,
  }: ImageProcessingRequest): Promise<ImageProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting image processing', {
        jobId,
        userId,
        originalImageS3Key,
        prompt,
      });

      // Download original image from S3
      const originalBuffer = await s3Service.downloadBuffer(originalImageS3Key);
      
      // Preprocess image
      const preprocessedBuffer = await this.preprocessImage(originalBuffer);

      // Convert to base64 for Gemini
      const base64Image = preprocessedBuffer.toString('base64');
      const mimeType = 'image/jpeg';

      // Build enhanced prompt
      const enhancedPrompt = this.buildPrompt(prompt);

      // Call Gemini Vision API
      const result = await this.model.generateContent([
        enhancedPrompt,
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
      ]);

      const response = await result.response;
      
      if (!response) {
        throw new Error('No response from Gemini API');
      }

      // Note: Gemini Vision API doesn't directly return processed images
      // This is a conceptual implementation - in practice, you might need to:
      // 1. Use a different Google AI service that supports image generation
      // 2. Use the text response to guide another image processing service
      // 3. Integrate with other AI image generation APIs

      // For now, we'll simulate the process and return the original image
      // In production, you'd implement actual image generation here
      
      const processedImageS3Key = s3Service.generateS3Key(
        userId, 
        `processed_${Date.now()}.jpg`, 
        'processed'
      );

      // Upload processed image to S3
      // In a real implementation, this would be the actual processed image
      await s3Service.uploadBuffer(
        preprocessedBuffer,
        processedImageS3Key,
        'image/jpeg',
        {
          userId,
          jobId,
          originalImageS3Key,
          prompt,
          processedAt: new Date().toISOString(),
          geminiResponse: response.text(),
        }
      );

      const processedImageUrl = s3Service.getPublicUrl(processedImageS3Key);
      const processingTime = Date.now() - startTime;

      logger.info('Image processing completed', {
        jobId,
        userId,
        processedImageS3Key,
        processingTime,
      });

      return {
        processedImageS3Key,
        processedImageUrl,
        processingTime,
        geminiRequestId: jobId, // Use jobId as request identifier
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Image processing failed', {
        error,
        jobId,
        userId,
        originalImageS3Key,
        processingTime,
      });

      throw error;
    }
  }

  async validateImageContent(imageBuffer: Buffer): Promise<boolean> {
    try {
      const base64Image = imageBuffer.toString('base64');
      
      const result = await this.model.generateContent([
        `Analyze this image and determine if it contains:
        1. A clear human face (primary subject)
        2. Appropriate content suitable for a dating profile
        3. No inappropriate, violent, or explicit content
        
        Respond with only "APPROVED" or "REJECTED" followed by a brief reason.`,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const response = await result.response;
      const text = response.text().toUpperCase();
      
      const isApproved = text.includes('APPROVED');
      
      logger.info('Image content validation completed', {
        isApproved,
        response: text.substring(0, 100), // Log first 100 chars
      });

      return isApproved;
    } catch (error) {
      logger.error('Image content validation failed', { error });
      // Default to rejecting if validation fails
      return false;
    }
  }

  async analyzeImageForPromptSuggestions(imageBuffer: Buffer): Promise<string[]> {
    try {
      const base64Image = imageBuffer.toString('base64');
      
      const result = await this.model.generateContent([
        `Analyze this image and suggest 5 different photo scenarios that would work well for enhancing this person's dating profile. 
        
        Consider the person's features, current setting, and what scenarios would be most appealing. 
        
        Suggest scenarios like: professional headshot, casual outdoor, fitness/gym, beach/vacation, formal event, etc.
        
        Respond with exactly 5 scenarios, one per line, in this format:
        - Scenario name: Brief description`,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const response = await result.response;
      const suggestions = response.text()
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .slice(0, 5);

      logger.info('Generated prompt suggestions', {
        suggestionsCount: suggestions.length,
      });

      return suggestions;
    } catch (error) {
      logger.error('Failed to analyze image for suggestions', { error });
      
      // Return default suggestions if analysis fails
      return [
        'Professional business portrait: Clean, confident headshot in business attire',
        'Casual outdoor setting: Natural lighting in a park or outdoor location',
        'Fitness/active lifestyle: Gym or sports setting showcasing health-conscious lifestyle',
        'Beach vacation vibes: Relaxed, travel-inspired setting with good lighting',
        'Smart casual social: Coffee shop or urban setting for approachable, social vibe',
      ];
    }
  }
}

export const geminiService = new GeminiService();