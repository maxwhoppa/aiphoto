import { GoogleGenAI } from '@google/genai';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { s3Service } from './s3';
import { ValidationWarning } from '../db/schema';

export interface ValidationResult {
  imageId: string;
  isValid: boolean;
  warnings: ValidationWarning[];
  details: {
    multiplePeople: boolean;
    faceCoveredOrBlurred: boolean;
    poorLighting: boolean;
    isScreenshot: boolean;
    facePartiallyCovered: boolean;
  };
}

interface GeminiValidationResponse {
  multiple_people: boolean;
  face_covered_or_blurred: boolean;
  poor_lighting: boolean;
  is_screenshot: boolean;
  face_partially_covered: boolean;
}

class PhotoValidationService {
  private ai: GoogleGenAI;
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: config.GOOGLE_GEMINI_API_KEY,
    });
    logger.info('PhotoValidation service initialized');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
          await this.sleep(this.minRequestInterval - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();

        return await operation();
      } catch (error: any) {
        const isRateLimitError = error.message?.includes('429') || error.message?.includes('quota');
        const isLastAttempt = attempt === maxRetries - 1;

        if (isRateLimitError && !isLastAttempt) {
          const retryDelayMatch = error.message?.match(/retry in ([\d.]+)s/);
          const suggestedDelay = retryDelayMatch ? parseFloat(retryDelayMatch[1]) * 1000 : baseDelay * Math.pow(2, attempt);

          logger.warn(`Rate limit hit during validation, retrying in ${suggestedDelay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            error: error.message,
          });

          await this.sleep(suggestedDelay);
          continue;
        }

        if (isLastAttempt || !isRateLimitError) {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  async validateImage(imageId: string, s3Key: string): Promise<ValidationResult> {
    try {
      logger.info('Starting photo validation', { imageId, s3Key });

      const result = await this.withRetry(async () => {
        // Generate pre-signed download URL for the image
        const downloadUrlData = await s3Service.generateDownloadUrl(s3Key, 3600);

        // Download the image
        const imageResponse = await fetch(downloadUrlData.downloadUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        const validationPrompt = `Analyze this photo for dating profile suitability. Evaluate the following criteria:

1. MULTIPLE_PEOPLE: Is there more than one person clearly visible in this photo? (Look for multiple distinct faces or bodies)
2. FACE_VISIBILITY: Is the main subject's face completely covered, obscured, or significantly blurred? (Sunglasses are OK, but masks, heavy blur, or turned away are not)
3. LIGHTING: Is the lighting so dark that the main subject's face is not clearly visible?
4. SCREENSHOT: Is this a screenshot of another photo, social media post, or screen capture? (Look for UI elements, status bars, app interfaces, photo-of-a-screen artifacts, watermarks from other apps, or visible device bezels)
5. FACE_PARTIALLY_COVERED: Are key facial features (eyes, nose, mouth, chin, or most of the hair/forehead) partially covered or hidden? (e.g., hand covering mouth, hair covering eyes, cropped forehead, chin cut off, face cut off at edges - sunglasses alone are OK)

Respond with ONLY a valid JSON object in this exact format, no additional text:
{"multiple_people": true or false, "face_covered_or_blurred": true or false, "poor_lighting": true or false, "is_screenshot": true or false, "face_partially_covered": true or false}`;

        const promptContent = [
          { text: validationPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
        ];

        const response = await this.ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: promptContent,
        });

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('No response from Gemini for validation');
        }

        const textPart = candidates[0]?.content?.parts?.find(part => part.text);
        const responseText = textPart?.text || '';

        logger.info('Gemini validation response', { imageId, responseText });

        // Parse the JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`Invalid JSON response from Gemini: ${responseText}`);
        }

        const validationData: GeminiValidationResponse = JSON.parse(jsonMatch[0]);

        return validationData;
      });

      // Build warnings array
      const warnings: ValidationWarning[] = [];
      if (result.multiple_people) {
        warnings.push('multiple_people');
      }
      if (result.face_covered_or_blurred) {
        warnings.push('face_covered_or_blurred');
      }
      if (result.poor_lighting) {
        warnings.push('poor_lighting');
      }
      if (result.is_screenshot) {
        warnings.push('is_screenshot');
      }
      if (result.face_partially_covered) {
        warnings.push('face_partially_covered');
      }

      const isValid = warnings.length === 0;

      logger.info('Photo validation completed', {
        imageId,
        isValid,
        warnings,
      });

      return {
        imageId,
        isValid,
        warnings,
        details: {
          multiplePeople: result.multiple_people,
          faceCoveredOrBlurred: result.face_covered_or_blurred,
          poorLighting: result.poor_lighting,
          isScreenshot: result.is_screenshot,
          facePartiallyCovered: result.face_partially_covered,
        },
      };
    } catch (error) {
      logger.error('Photo validation failed', {
        imageId,
        error: error instanceof Error ? error.message : error,
      });

      // Return as failed validation with no specific warnings (validation system error)
      return {
        imageId,
        isValid: false,
        warnings: [],
        details: {
          multiplePeople: false,
          faceCoveredOrBlurred: false,
          poorLighting: false,
          isScreenshot: false,
          facePartiallyCovered: false,
        },
      };
    }
  }

  async validateBatch(
    images: Array<{ id: string; s3Key: string }>
  ): Promise<ValidationResult[]> {
    logger.info('Starting batch validation', { imageCount: images.length });

    // Process images sequentially to respect rate limits
    const results: ValidationResult[] = [];

    for (const image of images) {
      const result = await this.validateImage(image.id, image.s3Key);
      results.push(result);
    }

    const validCount = results.filter(r => r.isValid).length;
    logger.info('Batch validation completed', {
      total: images.length,
      valid: validCount,
      withWarnings: images.length - validCount,
    });

    return results;
  }
}

export const photoValidationService = new PhotoValidationService();
export default photoValidationService;
