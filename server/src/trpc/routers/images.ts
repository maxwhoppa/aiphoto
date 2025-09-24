import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, userImages, generatedImages, users, scenarios } from '../../db/index';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { geminiService } from '../../services/gemini';
import { s3Service } from '../../services/s3';

export const imagesRouter = router({
  // Get presigned upload URLs for S3
  getUploadUrls: protectedProcedure
    .input(z.object({
      files: z.array(z.object({
        fileName: z.string(),
        contentType: z.string(),
        sizeBytes: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const uploadUrls = await Promise.all(
        input.files.map(async (file) => {
          const uploadData = await s3Service.generateUploadUrl(
            ctx.user.sub,
            file.fileName,
            file.contentType
          );
          
          return {
            fileName: file.fileName,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
            uploadUrl: uploadData.uploadUrl,
            s3Key: uploadData.s3Key,
            s3Url: uploadData.s3Url,
          };
        })
      );

      logger.info('Generated upload URLs', {
        cognitoUserId: ctx.user.sub,
        fileCount: input.files.length,
      });

      return { uploadUrls };
    }),

  // Record uploaded images after S3 upload
  recordUploadedImages: protectedProcedure
    .input(z.object({
      images: z.array(z.object({
        fileName: z.string(),
        contentType: z.string(),
        sizeBytes: z.number(),
        s3Key: z.string(),
        s3Url: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get or create user in database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      let user = userResults[0];

      if (!user) {
        const [newUser] = await db.insert(users).values({
          cognitoId: ctx.user.sub,
          email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
        }).returning();
        user = newUser;
      }

      // Validate that files exist in S3
      const validatedImages = await Promise.all(
        input.images.map(async (imageData) => {
          try {
            const exists = await s3Service.checkFileExists(imageData.s3Key);
            if (!exists) {
              logger.warn('S3 file does not exist', {
                s3Key: imageData.s3Key,
                cognitoUserId: ctx.user.sub,
              });
              return { ...imageData, valid: false, error: 'File not found in S3' };
            }
            return { ...imageData, valid: true };
          } catch (error) {
            logger.error('S3 validation error', {
              s3Key: imageData.s3Key,
              error,
            });
            return { ...imageData, valid: false, error: 'Failed to validate S3 file' };
          }
        })
      );

      // Only record valid images
      const validImages = validatedImages.filter(img => img.valid);
      const invalidImages = validatedImages.filter(img => !img.valid);

      if (validImages.length === 0) {
        throw new Error('No valid images found in S3');
      }

      const uploadedImages = await Promise.all(
        validImages.map(async (imageData) => {
          const [newImage] = await db
            .insert(userImages)
            .values({
              userId: user.id,
              originalFileName: imageData.fileName,
              s3Key: imageData.s3Key,
              s3Url: imageData.s3Url,
              contentType: imageData.contentType,
              sizeBytes: imageData.sizeBytes.toString(),
            })
            .returning();

          return newImage;
        })
      );

      logger.info('Images recorded', {
        cognitoUserId: ctx.user.sub,
        validCount: uploadedImages.length,
        invalidCount: invalidImages.length,
      });

      return { 
        images: uploadedImages,
        skipped: invalidImages.map(img => ({
          fileName: img.fileName,
          error: img.error,
        })),
      };
    }),

  // Generate AI images for multiple scenarios
  generateImages: protectedProcedure
    .input(z.object({
      imageIds: z.array(z.string().uuid()),
      scenarios: z.array(z.string()),
      customPrompts: z.record(z.string()).optional(), // scenario -> custom prompt
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get or create user in database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      let user = userResults[0];

      if (!user) {
        const [newUser] = await db.insert(users).values({
          cognitoId: ctx.user.sub,
          email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
        }).returning();
        user = newUser;
      }

      // Get all user's images
      const images = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id),
          // Only include requested image IDs
        ));

      const userImageIds = images.map(img => img.id);
      const validImageIds = input.imageIds.filter(id => userImageIds.includes(id));

      if (validImageIds.length === 0) {
        throw new Error('No valid images found');
      }

      const results: Array<{ imageId: string; scenario: string; success: boolean; generatedImageId?: string; error?: string }> = [];

      // Process each image with each scenario
      for (const imageId of validImageIds) {
        const image = images.find(img => img.id === imageId)!;
        
        for (const scenario of input.scenarios) {
          try {
            const customPrompt = input.customPrompts?.[scenario];
            const prompt = customPrompt || await geminiService.generateImagePrompt(scenario);

            // Process with Gemini
            const result = await geminiService.processImageWithScenario(
              image.s3Url,
              scenario,
              customPrompt
            );

            if (result.error) {
              results.push({
                imageId,
                scenario,
                success: false,
                error: result.error,
              });
              continue;
            }

            // Generate S3 upload URL for the generated image
            const uploadData = await s3Service.generateGeneratedImageUploadUrl(
              user.id,
              imageId,
              scenario
            );

            // Process with Gemini and get the generated image
            const generatedImageResult = await geminiService.generateAndUploadImage(
              image.s3Url,
              scenario,
              customPrompt,
              uploadData.uploadUrl
            );

            if (generatedImageResult.error) {
              results.push({
                imageId,
                scenario,
                success: false,
                error: generatedImageResult.error,
              });
              continue;
            }

            // Save generated image record
            const [generatedImage] = await db
              .insert(generatedImages)
              .values({
                userId: user.id,
                originalImageId: imageId,
                scenario,
                prompt,
                s3Key: uploadData.s3Key,
                s3Url: uploadData.s3Url,
                geminiRequestId: generatedImageResult.requestId,
              })
              .returning();

            results.push({
              imageId,
              scenario,
              success: true,
              generatedImageId: generatedImage.id,
            });

            logger.info('Image generated successfully', {
              cognitoUserId: ctx.user.sub,
              originalImageId: imageId,
              scenario,
              generatedImageId: generatedImage.id,
            });

          } catch (error) {
            results.push({
              imageId,
              scenario,
              success: false,
              error: error instanceof Error ? error.message : 'Processing failed',
            });

            logger.error('Image generation failed', {
              cognitoUserId: ctx.user.sub,
              originalImageId: imageId,
              scenario,
              error,
            });
          }
        }
      }

      return {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  // Get generated images
  getGeneratedImages: protectedProcedure
    .input(z.object({
      originalImageId: z.string().uuid().optional(),
      scenario: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      let query = db
        .select()
        .from(generatedImages)
        .where(eq(generatedImages.userId, user.id))
        .$dynamic();

      if (input.originalImageId) {
        query = query.where(eq(generatedImages.originalImageId, input.originalImageId));
      }

      if (input.scenario) {
        query = query.where(eq(generatedImages.scenario, input.scenario));
      }

      const images = await query.orderBy(desc(generatedImages.createdAt));

      return images;
    }),

  // Get generated image by ID
  getGeneratedImage: protectedProcedure
    .input(z.object({
      generatedImageId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      const [generatedImage] = await db
        .select()
        .from(generatedImages)
        .where(and(
          eq(generatedImages.id, input.generatedImageId),
          eq(generatedImages.userId, user.id)
        ))
        .limit(1);

      if (!generatedImage) {
        throw new Error('Generated image not found');
      }

      return generatedImage;
    }),

  // Delete image
  deleteImage: protectedProcedure
    .input(z.object({
      imageId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      const deletedImages = await db
        .delete(userImages)
        .where(and(
          eq(userImages.id, input.imageId),
          eq(userImages.userId, user.id)
        ))
        .returning();

      if (deletedImages.length === 0) {
        throw new Error('Image not found');
      }

      logger.info('Image deleted', {
        cognitoUserId: ctx.user.sub,
        imageId: input.imageId,
      });

      return { success: true };
    }),

  // Get user's images
  getMyImages: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();
      
      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      const images = await db
        .select()
        .from(userImages)
        .where(eq(userImages.userId, user.id))
        .orderBy(desc(userImages.createdAt));

      return images;
    }),

  // Get available scenarios
  getScenarios: protectedProcedure
    .query(async () => {
      const db = getDb();
      
      const availableScenarios = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.isActive, true))
        .orderBy(scenarios.sortOrder);

      return availableScenarios;
    }),

  // Delete generated image
  deleteGeneratedImage: protectedProcedure
    .input(z.object({
      generatedImageId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      const deletedImages = await db
        .delete(generatedImages)
        .where(and(
          eq(generatedImages.id, input.generatedImageId),
          eq(generatedImages.userId, user.id)
        ))
        .returning();

      if (deletedImages.length === 0) {
        throw new Error('Generated image not found');
      }

      logger.info('Generated image deleted', {
        cognitoUserId: ctx.user.sub,
        generatedImageId: input.generatedImageId,
      });

      return { success: true };
    }),
});