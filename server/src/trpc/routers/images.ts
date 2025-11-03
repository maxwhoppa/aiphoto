import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, userImages, generatedImages, users, scenarios } from '../../db/index';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
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
              return { ...imageData, valid: false, error: 'File not found in S3' } as const;
            }
            return { ...imageData, valid: true } as const;
          } catch (error) {
            logger.error('S3 validation error', {
              s3Key: imageData.s3Key,
              error,
            });
            return { ...imageData, valid: false, error: 'Failed to validate S3 file' } as const;
          }
        })
      );

      // Only record valid images
      const validImages = validatedImages.filter((img): img is typeof img & { valid: true } => img.valid);
      const invalidImages = validatedImages.filter((img): img is typeof img & { valid: false; error: string } => !img.valid);

      if (validImages.length === 0) {
        throw new Error('No valid images found in S3');
      }

      const uploadedImages = await Promise.all(
        validImages.map(async (imageData) => {
          try {
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
          } catch (error: any) {
            // Check if it's a unique constraint violation
            if (error.code === '23505' && error.constraint?.includes('userId_s3Key')) {
              logger.info('Image already exists, skipping duplicate', {
                s3Key: imageData.s3Key,
                cognitoUserId: ctx.user.sub,
              });
              
              // Return the existing image
              const [existingImage] = await db
                .select()
                .from(userImages)
                .where(and(
                  eq(userImages.userId, user.id),
                  eq(userImages.s3Key, imageData.s3Key)
                ))
                .limit(1);
                
              return existingImage;
            }
            throw error;
          }
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

      // Get user's images that match the requested IDs
      const images = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id)
        ));

      const userImageIds = images.map(img => img.id);
      const validImageIds = input.imageIds.filter(id => userImageIds.includes(id));

      if (validImageIds.length === 0) {
        throw new Error('No valid images found');
      }

      // Create all image+scenario combinations for parallel processing
      const processingTasks = [];
      
      for (const imageId of validImageIds) {
        const image = images.find(img => img.id === imageId)!;
        
        for (const scenario of input.scenarios) {
          processingTasks.push({
            imageId,
            image,
            scenario,
            customPrompt: input.customPrompts?.[scenario],
          });
        }
      }

      logger.info('Starting parallel image generation', {
        cognitoUserId: ctx.user.sub,
        totalTasks: processingTasks.length,
        imageCount: validImageIds.length,
        scenarioCount: input.scenarios.length,
      });

      // Process in smaller batches to avoid quota limits
      const BATCH_SIZE = 30; // Process 10 images at a time to avoid quota limits
      const results: any[] = [];
      
      for (let i = 0; i < processingTasks.length; i += BATCH_SIZE) {
        const batch = processingTasks.slice(i, i + BATCH_SIZE);
        
        logger.info('Processing batch', {
          cognitoUserId: ctx.user.sub,
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          totalBatches: Math.ceil(processingTasks.length / BATCH_SIZE),
          batchSize: batch.length,
        });

        const batchResults = await Promise.allSettled(
          batch.map(async (task) => {
          try {
            const customPrompt = task.customPrompt;
            const prompt = customPrompt || await geminiService.generateImagePrompt(task.scenario);

            // Process with Gemini
            const result = await geminiService.processImageWithScenario(
              task.image.s3Key,
              task.scenario,
              customPrompt
            );

            if (result.error) {
              return {
                imageId: task.imageId,
                scenario: task.scenario,
                success: false,
                error: result.error,
              };
            }

            // Generate S3 upload URL for the generated image
            const uploadData = await s3Service.generateGeneratedImageUploadUrl(
              user.id,
              task.imageId,
              task.scenario
            );

            // Process with Gemini and get the generated image
            const generatedImageResult = await geminiService.generateAndUploadImage(
              task.image.s3Key,
              task.scenario,
              customPrompt,
              uploadData.uploadUrl
            );

            if (generatedImageResult.error) {
              return {
                imageId: task.imageId,
                scenario: task.scenario,
                success: false,
                error: generatedImageResult.error,
              };
            }

            // Save generated image record
            const [generatedImage] = await db
              .insert(generatedImages)
              .values({
                userId: user.id,
                originalImageId: task.imageId,
                scenario: task.scenario,
                prompt,
                s3Key: uploadData.s3Key,
                s3Url: uploadData.s3Url,
                geminiRequestId: generatedImageResult.requestId,
              })
              .returning();

            logger.info('Image generated successfully', {
              cognitoUserId: ctx.user.sub,
              originalImageId: task.imageId,
              scenario: task.scenario,
              generatedImageId: generatedImage.id,
            });

            return {
              imageId: task.imageId,
              scenario: task.scenario,
              success: true,
              generatedImageId: generatedImage.id,
            };

          } catch (error) {
            logger.error('Image generation failed', {
              cognitoUserId: ctx.user.sub,
              originalImageId: task.imageId,
              scenario: task.scenario,
              error,
            });

            return {
              imageId: task.imageId,
              scenario: task.scenario,
              success: false,
              error: error instanceof Error ? error.message : 'Processing failed',
            };
          }
        })
      );

      // Add batch results to overall results
      results.push(...batchResults);
    }

      // Extract results from Promise.allSettled
      const processedResults = results.map(result =>
        result.status === 'fulfilled' ? result.value : {
          imageId: 'unknown',
          scenario: 'unknown',
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Processing failed'
        }
      );

      // After successful generation, auto-select profile photos if none exist
      const successfulGenerations = processedResults.filter(r => r.success);

      if (successfulGenerations.length > 0) {
        // Check if user already has profile selections
        const existingSelections = await db
          .select()
          .from(generatedImages)
          .where(
            and(
              eq(generatedImages.userId, user.id),
              isNotNull(generatedImages.selectedProfileOrder)
            )
          );

        // Only auto-select if no existing selections
        if (existingSelections.length === 0) {
          logger.info('Auto-selecting profile photos for user', {
            cognitoUserId: ctx.user.sub,
            generatedCount: successfulGenerations.length,
          });

          // Get all generated images for this user to randomly select from
          const allGeneratedImages = await db
            .select()
            .from(generatedImages)
            .where(eq(generatedImages.userId, user.id))
            .orderBy(desc(generatedImages.createdAt));

          if (allGeneratedImages.length > 0) {
            // Randomly select up to 6 images
            const shuffled = [...allGeneratedImages].sort(() => Math.random() - 0.5);
            const toSelect = shuffled.slice(0, Math.min(6, shuffled.length));

            // Update the selected images with their profile order
            await db.transaction(async (tx) => {
              for (let i = 0; i < toSelect.length; i++) {
                await tx
                  .update(generatedImages)
                  .set({ selectedProfileOrder: i + 1 })
                  .where(eq(generatedImages.id, toSelect[i].id));
              }
            });

            logger.info('Profile photos auto-selected', {
              cognitoUserId: ctx.user.sub,
              selectedCount: toSelect.length,
            });
          }
        }
      }

      return {
        processed: processedResults.length,
        successful: processedResults.filter(r => r.success).length,
        failed: processedResults.filter(r => !r.success).length,
        results: processedResults,
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

      // Generate pre-signed download URLs for all images
      const imagesWithPresignedUrls = await Promise.all(
        images.map(async (image) => {
          try {
            const downloadUrlData = await s3Service.generateDownloadUrl(image.s3Key, 604800); // 7 days (max expiry)
            return {
              ...image,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.warn('Failed to generate download URL', {
              imageId: image.id,
              s3Key: image.s3Key,
              error,
            });
            return {
              ...image,
              downloadUrl: null,
            };
          }
        })
      );

      return imagesWithPresignedUrls;
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

      // Generate pre-signed download URL
      try {
        const downloadUrlData = await s3Service.generateDownloadUrl(generatedImage.s3Key, 604800); // 7 days (max expiry)
        return {
          ...generatedImage,
          downloadUrl: downloadUrlData.downloadUrl,
        };
      } catch (error) {
        logger.warn('Failed to generate download URL for single image', {
          imageId: generatedImage.id,
          s3Key: generatedImage.s3Key,
          error,
        });
        return {
          ...generatedImage,
          downloadUrl: null,
        };
      }
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

      // Generate pre-signed download URLs for all user images
      const imagesWithPresignedUrls = await Promise.all(
        images.map(async (image) => {
          try {
            const downloadUrlData = await s3Service.generateDownloadUrl(image.s3Key, 604800); // 7 days (max expiry)
            return {
              ...image,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.warn('Failed to generate download URL for user image', {
              imageId: image.id,
              s3Key: image.s3Key,
              error,
            });
            return {
              ...image,
              downloadUrl: null,
            };
          }
        })
      );

      return imagesWithPresignedUrls;
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

  // Set selected profile photos
  setSelectedProfilePhotos: protectedProcedure
    .input(z.object({
      selections: z.array(z.object({
        generatedImageId: z.string().uuid(),
        order: z.number().min(1).max(6),
      })).max(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Start transaction to update all selections atomically
      await db.transaction(async (tx) => {
        // First, clear all existing selections for this user
        await tx
          .update(generatedImages)
          .set({ selectedProfileOrder: null })
          .where(eq(generatedImages.userId, user.id));

        // Then set the new selections
        for (const selection of input.selections) {
          const result = await tx
            .update(generatedImages)
            .set({ selectedProfileOrder: selection.order })
            .where(and(
              eq(generatedImages.id, selection.generatedImageId),
              eq(generatedImages.userId, user.id)
            ))
            .returning();

          if (result.length === 0) {
            throw new Error(`Image ${selection.generatedImageId} not found or not owned by user`);
          }
        }
      });

      logger.info('Profile photos selected', {
        cognitoUserId: ctx.user.sub,
        selections: input.selections.length,
      });

      return { success: true };
    }),

  // Get selected profile photos
  getSelectedProfilePhotos: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      const selectedPhotos = await db
        .select()
        .from(generatedImages)
        .where(and(
          eq(generatedImages.userId, user.id),
          isNotNull(generatedImages.selectedProfileOrder)
        ))
        .orderBy(generatedImages.selectedProfileOrder);

      // Generate pre-signed download URLs for all selected photos
      const photosWithUrls = await Promise.all(
        selectedPhotos.map(async (photo) => {
          try {
            const downloadUrlData = await s3Service.generateDownloadUrl(photo.s3Key, 604800);
            return {
              ...photo,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.warn('Failed to generate download URL for selected photo', {
              imageId: photo.id,
              s3Key: photo.s3Key,
              error,
            });
            return {
              ...photo,
              downloadUrl: null,
            };
          }
        })
      );

      return photosWithUrls;
    }),

  // Toggle single photo selection
  toggleProfilePhotoSelection: protectedProcedure
    .input(z.object({
      generatedImageId: z.string().uuid(),
      order: z.number().min(1).max(6).optional(), // If provided, set to this order; if not, remove from selection
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      if (input.order) {
        // Check if another photo already has this order
        const existingAtOrder = await db
          .select()
          .from(generatedImages)
          .where(and(
            eq(generatedImages.userId, user.id),
            eq(generatedImages.selectedProfileOrder, input.order)
          ))
          .limit(1);

        if (existingAtOrder.length > 0) {
          // Clear the existing photo at this order
          await db
            .update(generatedImages)
            .set({ selectedProfileOrder: null })
            .where(eq(generatedImages.id, existingAtOrder[0].id));
        }
      }

      // Update the selected photo
      const result = await db
        .update(generatedImages)
        .set({ selectedProfileOrder: input.order || null })
        .where(and(
          eq(generatedImages.id, input.generatedImageId),
          eq(generatedImages.userId, user.id)
        ))
        .returning();

      if (result.length === 0) {
        throw new Error('Image not found or not owned by user');
      }

      logger.info('Profile photo selection toggled', {
        cognitoUserId: ctx.user.sub,
        generatedImageId: input.generatedImageId,
        order: input.order,
      });

      return { success: true, photo: result[0] };
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