import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, userImages, generatedImages, users, scenarios, payments, generations } from '../../db/index';
import { eq, desc, and, isNotNull, or, inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { geminiService } from '../../services/gemini';
import { s3Service } from '../../services/s3';
import { photoValidationService } from '../../services/photoValidation';
import { ValidationStatus, ValidationWarning } from '../../db/schema';

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
      paymentId: z.string().optional(), // Optional payment ID or session ID to redeem
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

      // Handle payment validation and redemption
      let paymentRecord = null;

      // First check if user has any unredeemed payment (they should have paid before generating)
      const unredeemedPayments = await db
        .select()
        .from(payments)
        .where(and(
          eq(payments.userId, user.id),
          eq(payments.redeemed, false)
        ))
        .orderBy(desc(payments.paidAt))
        .limit(1);

      if (unredeemedPayments.length === 0) {
        throw new Error('No unredeemed payment found. Please complete payment before generating images.');
      }

      paymentRecord = unredeemedPayments[0];

      // If a specific paymentId was provided, verify it matches
      if (input.paymentId) {
        console.log('DEBUG: generateImages received paymentId:', input.paymentId);

        // Check if provided paymentId matches the unredeemed payment
        const isValidPayment = paymentRecord.id === input.paymentId ||
                              paymentRecord.transactionId === input.paymentId;

        if (!isValidPayment) {
          // Try to find the specific payment they requested
          let specificPaymentResults;
          if (input.paymentId.includes('cs_')) {
            // This looks like a Stripe session ID
            specificPaymentResults = await db
              .select()
              .from(payments)
              .where(and(
                eq(payments.transactionId, input.paymentId),
                eq(payments.userId, user.id)
              ))
              .limit(1);
          } else {
            // This looks like a payment UUID
            specificPaymentResults = await db
              .select()
              .from(payments)
              .where(and(
                eq(payments.id, input.paymentId),
                eq(payments.userId, user.id)
              ))
              .limit(1);
          }

          if (specificPaymentResults.length > 0) {
            const specificPayment = specificPaymentResults[0];
            if (specificPayment.redeemed) {
              throw new Error('This payment has already been used for photo generation.');
            }
            // Use the specific payment they requested
            paymentRecord = specificPayment;
          } else {
            throw new Error('Invalid payment ID provided.');
          }
        }
      }

      // Mark payment as redeemed
      await db
        .update(payments)
        .set({
          redeemed: true,
          redeemedAt: new Date(),
        })
        .where(eq(payments.id, paymentRecord.id));

      logger.info('Payment redeemed for photo generation', {
        paymentId: paymentRecord.id,
        sessionId: paymentRecord.transactionId,
        cognitoUserId: ctx.user.sub,
        userId: user.id,
      });

      // Create generation record
      const totalImages = input.imageIds.length * input.scenarios.length;
      const [generation] = await db.insert(generations).values({
        userId: user.id,
        paymentId: paymentRecord.id, // Always link to the payment since we validated it exists
        generationStatus: 'in_progress',
        totalImages,
        completedImages: 0,
        scenarios: JSON.stringify(input.scenarios),
      }).returning();

      console.log('DEBUG: Created generation record:', generation.id);

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
            console.log('\n=== PROCESSING IMAGE TASK ===');
            console.log('Image ID:', task.imageId);
            console.log('Scenario:', task.scenario);

            const prompt = await geminiService.generateImagePrompt(task.scenario);

            console.log('Generated prompt length:', prompt.length);
            console.log('First 200 chars of prompt:', prompt.substring(0, 200));
            console.log('=== END TASK SETUP ===\n');

            // Process with Gemini
            const result = await geminiService.processImageWithScenario(
              task.image.s3Key,
              task.scenario,
              prompt // Use the resolved prompt instead of customPrompt
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

            // Process with Gemini and get the generated image - with retry logic
            let generatedImageResult;
            let lastError;
            const MAX_RETRIES = 3;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                logger.info('Attempting image generation', {
                  cognitoUserId: ctx.user.sub,
                  imageId: task.imageId,
                  scenario: task.scenario,
                  attempt,
                  maxRetries: MAX_RETRIES,
                });

                console.log('\n>>> CALLING generateAndUploadImage <<<');
                console.log('Scenario:', task.scenario);
                console.log('Prompt being passed:', prompt.substring(0, 300));
                console.log('>>> END CALL SETUP <<<\n');

                generatedImageResult = await geminiService.generateAndUploadImage(
                  task.image.s3Key,
                  task.scenario,
                  prompt, // Use the resolved prompt instead of customPrompt
                  uploadData.uploadUrl
                );

                if (!generatedImageResult.error) {
                  // Success! Break out of retry loop
                  if (attempt > 1) {
                    logger.info('Image generation succeeded after retry', {
                      cognitoUserId: ctx.user.sub,
                      imageId: task.imageId,
                      scenario: task.scenario,
                      successfulAttempt: attempt,
                    });
                  }
                  break;
                }

                lastError = generatedImageResult.error;

                // If this isn't the last attempt, wait before retrying
                if (attempt < MAX_RETRIES) {
                  const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
                  logger.warn('Image generation failed, retrying', {
                    cognitoUserId: ctx.user.sub,
                    imageId: task.imageId,
                    scenario: task.scenario,
                    attempt,
                    error: generatedImageResult.error,
                    retryDelay: delay,
                  });

                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              } catch (error) {
                lastError = error instanceof Error ? error.message : 'Processing failed';

                if (attempt < MAX_RETRIES) {
                  const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                  logger.warn('Image generation threw error, retrying', {
                    cognitoUserId: ctx.user.sub,
                    imageId: task.imageId,
                    scenario: task.scenario,
                    attempt,
                    error: lastError,
                    retryDelay: delay,
                  });

                  await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                  logger.error('Image generation failed after all retries', {
                    cognitoUserId: ctx.user.sub,
                    imageId: task.imageId,
                    scenario: task.scenario,
                    finalError: lastError,
                  });
                }
              }
            }

            // Check if we still have an error after all retries
            if (generatedImageResult?.error || !generatedImageResult) {
              return {
                imageId: task.imageId,
                scenario: task.scenario,
                success: false,
                error: lastError || 'Image generation failed after all retries',
              };
            }

            // Save generated image record
            const [generatedImage] = await db
              .insert(generatedImages)
              .values({
                userId: user.id,
                generationId: generation.id,
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

      // Update generation status and completion count
      try {
        // Only mark as 'completed' if ALL expected images were successfully generated
        const newStatus = successfulGenerations.length === totalImages ? 'completed' : 'failed';
        await db
          .update(generations)
          .set({
            generationStatus: newStatus,
            completedImages: successfulGenerations.length,
            completedAt: new Date(),
          })
          .where(eq(generations.id, generation.id));

        logger.info(`Generation marked as ${newStatus}`, {
          generationId: generation.id,
          cognitoUserId: ctx.user.sub,
          completedImages: successfulGenerations.length,
          totalImages: totalImages,
          successfulCount: successfulGenerations.length,
          totalTasks: processedResults.length,
          isFullyComplete: successfulGenerations.length === totalImages,
        });
      } catch (error) {
        logger.error('Failed to update generation status', {
          generationId: generation.id,
          error,
        });
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
        logger.info('Updating profile photo selections', {
          cognitoUserId: ctx.user.sub,
          newSelections: input.selections,
        });

        // First, clear all existing selections for this user
        await tx
          .update(generatedImages)
          .set({ selectedProfileOrder: null })
          .where(eq(generatedImages.userId, user.id));

        // Then set the new selections
        for (const selection of input.selections) {
          logger.info('Setting photo order', {
            cognitoUserId: ctx.user.sub,
            imageId: selection.generatedImageId,
            order: selection.order,
          });

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

          logger.info('Photo order updated successfully', {
            cognitoUserId: ctx.user.sub,
            imageId: selection.generatedImageId,
            order: selection.order,
            resultId: result[0].id,
          });
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

  // Validate uploaded images using Gemini AI
  validateImages: protectedProcedure
    .input(z.object({
      imageIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Get user's images that match the requested IDs
      const images = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id),
          inArray(userImages.id, input.imageIds)
        ));

      if (images.length === 0) {
        throw new Error('No valid images found');
      }

      // Separate already-validated images from those needing validation
      const alreadyValidated = images.filter(
        img => img.validationStatus === 'validated' || img.validationStatus === 'bypassed'
      );
      const needsValidation = images.filter(
        img => img.validationStatus !== 'validated' && img.validationStatus !== 'bypassed'
      );

      logger.info('Starting image validation', {
        cognitoUserId: ctx.user.sub,
        total: images.length,
        alreadyValidated: alreadyValidated.length,
        needsValidation: needsValidation.length,
      });

      // Build results for already-validated images from stored data
      const existingResults = alreadyValidated.map(img => {
        let warnings: string[] = [];
        if (img.validationWarnings) {
          try {
            warnings = JSON.parse(img.validationWarnings);
          } catch {
            warnings = [];
          }
        }
        return {
          imageId: img.id,
          isValid: img.validationStatus === 'validated' || img.validationStatus === 'bypassed',
          warnings,
          details: {
            multipleFaces: warnings.includes('multiple_faces'),
            faceCoveredOrBlurred: warnings.includes('face_covered_or_blurred'),
            poorLighting: warnings.includes('poor_lighting'),
            isScreenshot: warnings.includes('is_screenshot'),
            facePartiallyCovered: warnings.includes('face_partially_covered'),
          },
        };
      });

      // Run validation only on images that need it
      let newValidationResults: typeof existingResults = [];
      if (needsValidation.length > 0) {
        newValidationResults = await photoValidationService.validateBatch(
          needsValidation.map(img => ({ id: img.id, s3Key: img.s3Key }))
        );
      }

      // Combine results
      const validationResults = [...existingResults, ...newValidationResults];

      // Update only newly validated images (skip already-validated ones)
      for (const result of newValidationResults) {
        const status: ValidationStatus = result.isValid ? 'validated' : 'failed';
        const warnings = result.warnings.length > 0 ? JSON.stringify(result.warnings) : null;

        await db
          .update(userImages)
          .set({
            validationStatus: status,
            validationWarnings: warnings,
            validatedAt: new Date(),
          })
          .where(eq(userImages.id, result.imageId));
      }

      const validCount = validationResults.filter(r => r.isValid).length;
      const imagesWithWarnings = validationResults
        .filter(r => !r.isValid)
        .map(r => r.imageId);

      logger.info('Image validation completed', {
        cognitoUserId: ctx.user.sub,
        total: validationResults.length,
        valid: validCount,
        withWarnings: imagesWithWarnings.length,
      });

      return {
        results: validationResults,
        allValid: validCount === validationResults.length,
        validCount,
        imagesWithWarnings,
      };
    }),

  // Validate a single image and trigger sample generation if needed
  validateSingleImage: protectedProcedure
    .input(z.object({
      imageId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const SAMPLE_SCENARIOS = ['white_photoshoot', 'pinterest_thirst', 'professional'];

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

      // Get the specific image
      const [image] = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id),
          eq(userImages.id, input.imageId)
        ))
        .limit(1);

      if (!image) {
        throw new Error('Image not found');
      }

      // Check if already validated
      if (image.validationStatus === 'validated' || image.validationStatus === 'bypassed') {
        let warnings: string[] = [];
        if (image.validationWarnings) {
          try {
            warnings = JSON.parse(image.validationWarnings);
          } catch {
            warnings = [];
          }
        }

        logger.info('Image already validated, skipping', {
          cognitoUserId: ctx.user.sub,
          imageId: input.imageId,
          status: image.validationStatus,
        });

        return {
          imageId: image.id,
          isValid: true,
          warnings,
          details: {
            multipleFaces: warnings.includes('multiple_faces'),
            faceCoveredOrBlurred: warnings.includes('face_covered_or_blurred'),
            poorLighting: warnings.includes('poor_lighting'),
            isScreenshot: warnings.includes('is_screenshot'),
            facePartiallyCovered: warnings.includes('face_partially_covered'),
          },
          sampleGenerationStarted: false,
        };
      }

      logger.info('Starting single image validation', {
        cognitoUserId: ctx.user.sub,
        imageId: input.imageId,
      });

      // Validate the image
      const validationResult = await photoValidationService.validateImage(image.id, image.s3Key);

      // Update the image with validation result
      const status: ValidationStatus = validationResult.isValid ? 'validated' : 'failed';
      const warnings = validationResult.warnings.length > 0 ? JSON.stringify(validationResult.warnings) : null;

      await db
        .update(userImages)
        .set({
          validationStatus: status,
          validationWarnings: warnings,
          validatedAt: new Date(),
        })
        .where(eq(userImages.id, input.imageId));

      logger.info('Single image validation completed', {
        cognitoUserId: ctx.user.sub,
        imageId: input.imageId,
        isValid: validationResult.isValid,
        warnings: validationResult.warnings,
      });

      // Check if sample photos already exist
      const existingSamples = await db
        .select()
        .from(generatedImages)
        .where(and(
          eq(generatedImages.userId, user.id),
          eq(generatedImages.isSample, true)
        ))
        .limit(1);

      let sampleGenerationStarted = false;

      // If no samples exist, check if we should generate them
      if (existingSamples.length === 0) {
        // Get all validated/bypassed images for this user
        const validatedImages = await db
          .select()
          .from(userImages)
          .where(and(
            eq(userImages.userId, user.id),
            or(
              eq(userImages.validationStatus, 'validated'),
              eq(userImages.validationStatus, 'bypassed')
            )
          ))
          .orderBy(desc(userImages.createdAt))
          .limit(3);

        // If we have at least 1 validated image, start sample generation in background
        if (validatedImages.length >= 1) {
          sampleGenerationStarted = true;

          logger.info('Starting sample photo generation after validation', {
            cognitoUserId: ctx.user.sub,
            validatedImageCount: validatedImages.length,
          });

          // Generate samples in background (don't await)
          (async () => {
            try {
              const generationResults = await Promise.allSettled(
                validatedImages.map(async (sourceImage, index) => {
                  const scenario = SAMPLE_SCENARIOS[index] || SAMPLE_SCENARIOS[0];

                  try {
                    const prompt = await geminiService.generateImagePrompt(scenario);

                    const uploadData = await s3Service.generateGeneratedImageUploadUrl(
                      user.id,
                      sourceImage.id,
                      `sample_${scenario}_${Date.now()}`
                    );

                    let generatedImageResult;
                    let lastError;
                    const MAX_RETRIES = 3;

                    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                      try {
                        generatedImageResult = await geminiService.generateAndUploadImage(
                          sourceImage.s3Key,
                          scenario,
                          prompt,
                          uploadData.uploadUrl
                        );

                        if (!generatedImageResult.error) {
                          break;
                        }

                        lastError = generatedImageResult.error;

                        if (attempt < MAX_RETRIES) {
                          const delay = Math.pow(2, attempt - 1) * 1000;
                          await new Promise(resolve => setTimeout(resolve, delay));
                        }
                      } catch (error) {
                        lastError = error instanceof Error ? error.message : 'Processing failed';

                        if (attempt < MAX_RETRIES) {
                          const delay = Math.pow(2, attempt - 1) * 1000;
                          await new Promise(resolve => setTimeout(resolve, delay));
                        }
                      }
                    }

                    if (generatedImageResult?.error || !generatedImageResult) {
                      throw new Error(lastError || 'Sample image generation failed');
                    }

                    // Save the sample image record
                    await db
                      .insert(generatedImages)
                      .values({
                        userId: user.id,
                        generationId: null,
                        originalImageId: sourceImage.id,
                        scenario,
                        prompt,
                        s3Key: uploadData.s3Key,
                        s3Url: uploadData.s3Url,
                        geminiRequestId: generatedImageResult.requestId,
                        isSample: true,
                      });

                    logger.info('Sample photo generated successfully', {
                      cognitoUserId: ctx.user.sub,
                      sourceImageId: sourceImage.id,
                      scenario,
                    });
                  } catch (error) {
                    logger.error('Sample photo generation failed for image', {
                      cognitoUserId: ctx.user.sub,
                      imageId: sourceImage.id,
                      scenario,
                      error: error instanceof Error ? error.message : error,
                    });
                    throw error;
                  }
                })
              );

              const successCount = generationResults.filter(r => r.status === 'fulfilled').length;
              logger.info('Background sample generation completed', {
                cognitoUserId: ctx.user.sub,
                successCount,
                failedCount: generationResults.length - successCount,
              });
            } catch (error) {
              logger.error('Background sample generation failed', {
                cognitoUserId: ctx.user.sub,
                error: error instanceof Error ? error.message : error,
              });
            }
          })();
        }
      }

      return {
        imageId: image.id,
        isValid: validationResult.isValid,
        warnings: validationResult.warnings,
        details: validationResult.details,
        sampleGenerationStarted,
      };
    }),

  // Bypass validation for specific images
  bypassValidation: protectedProcedure
    .input(z.object({
      imageIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Update images to bypassed status
      const updatedImages = await db
        .update(userImages)
        .set({
          validationStatus: 'bypassed',
          bypassedAt: new Date(),
        })
        .where(and(
          eq(userImages.userId, user.id),
          inArray(userImages.id, input.imageIds)
        ))
        .returning();

      logger.info('Validation bypassed for images', {
        cognitoUserId: ctx.user.sub,
        imageCount: updatedImages.length,
        imageIds: input.imageIds,
      });

      return { success: true, updatedCount: updatedImages.length };
    }),

  // Get user's image repository (previously uploaded validated/bypassed images)
  getImageRepository: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      // Get all user images that are validated or bypassed
      const images = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id),
          or(
            eq(userImages.validationStatus, 'validated'),
            eq(userImages.validationStatus, 'bypassed')
          )
        ))
        .orderBy(desc(userImages.createdAt));

      // Generate pre-signed download URLs for all images
      const imagesWithUrls = await Promise.all(
        images.map(async (image) => {
          try {
            const downloadUrlData = await s3Service.generateDownloadUrl(image.s3Key, 604800);
            return {
              ...image,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.warn('Failed to generate download URL for repository image', {
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

      logger.info('Image repository fetched', {
        cognitoUserId: ctx.user.sub,
        imageCount: imagesWithUrls.length,
      });

      return imagesWithUrls;
    }),

  // Replace an image (delete old one, keep the new one with pending validation)
  replaceImage: protectedProcedure
    .input(z.object({
      oldImageId: z.string().uuid(),
      newImage: z.object({
        fileName: z.string(),
        contentType: z.string(),
        sizeBytes: z.number(),
        s3Key: z.string(),
        s3Url: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Delete the old image
      const deletedImages = await db
        .delete(userImages)
        .where(and(
          eq(userImages.id, input.oldImageId),
          eq(userImages.userId, user.id)
        ))
        .returning();

      if (deletedImages.length === 0) {
        throw new Error('Old image not found or not owned by user');
      }

      // Validate the new file exists in S3
      const exists = await s3Service.checkFileExists(input.newImage.s3Key);
      if (!exists) {
        throw new Error('New image file not found in S3');
      }

      // Insert the new image with pending validation
      const [newImage] = await db
        .insert(userImages)
        .values({
          userId: user.id,
          originalFileName: input.newImage.fileName,
          s3Key: input.newImage.s3Key,
          s3Url: input.newImage.s3Url,
          contentType: input.newImage.contentType,
          sizeBytes: input.newImage.sizeBytes.toString(),
          validationStatus: 'pending',
        })
        .returning();

      logger.info('Image replaced', {
        cognitoUserId: ctx.user.sub,
        oldImageId: input.oldImageId,
        newImageId: newImage.id,
      });

      return { success: true, newImage };
    }),

  // Generate sample photos using validated images (for preview before payment)
  generateSamplePhotos: protectedProcedure
    .input(z.object({
      imageIds: z.array(z.string().uuid()).min(1).max(3), // Up to 3 validated images
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Use different scenarios for each sample
      const SAMPLE_SCENARIOS = ['white_photoshoot', 'pinterest_thirst', 'professional'];

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

      // Check if user already has sample photos
      const existingSamples = await db
        .select()
        .from(generatedImages)
        .where(and(
          eq(generatedImages.userId, user.id),
          eq(generatedImages.isSample, true)
        ))
        .orderBy(desc(generatedImages.createdAt))
        .limit(3);

      if (existingSamples.length >= 3) {
        // Return existing samples with download URLs
        const samplesWithUrls = await Promise.all(
          existingSamples.map(async (sample) => {
            try {
              const downloadUrlData = await s3Service.generateDownloadUrl(sample.s3Key, 604800);
              return {
                ...sample,
                downloadUrl: downloadUrlData.downloadUrl,
              };
            } catch (error) {
              return {
                ...sample,
                downloadUrl: null,
              };
            }
          })
        );

        return {
          success: true,
          alreadyExists: true,
          sampleImages: samplesWithUrls,
        };
      }

      // Get the user's source images
      const sourceImages = await db
        .select()
        .from(userImages)
        .where(and(
          eq(userImages.userId, user.id),
          inArray(userImages.id, input.imageIds)
        ));

      if (sourceImages.length === 0) {
        throw new Error('No valid images found');
      }

      logger.info('Starting sample photos generation', {
        cognitoUserId: ctx.user.sub,
        sourceImageCount: sourceImages.length,
        scenarios: SAMPLE_SCENARIOS.slice(0, sourceImages.length),
      });

      // Generate samples in parallel - each with a different scenario
      const generationResults = await Promise.allSettled(
        sourceImages.map(async (sourceImage, index) => {
          const scenario = SAMPLE_SCENARIOS[index] || SAMPLE_SCENARIOS[0];

          try {
            // Generate the prompt for this specific scenario
            const prompt = await geminiService.generateImagePrompt(scenario);

            // Generate S3 upload URL for the sample image
            const uploadData = await s3Service.generateGeneratedImageUploadUrl(
              user.id,
              sourceImage.id,
              `sample_${scenario}_${Date.now()}`
            );

            // Generate the image with retry logic
            let generatedImageResult;
            let lastError;
            const MAX_RETRIES = 3;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                logger.info('Attempting sample image generation', {
                  cognitoUserId: ctx.user.sub,
                  imageId: sourceImage.id,
                  scenario,
                  attempt,
                  maxRetries: MAX_RETRIES,
                });

                generatedImageResult = await geminiService.generateAndUploadImage(
                  sourceImage.s3Key,
                  scenario,
                  prompt,
                  uploadData.uploadUrl
                );

                if (!generatedImageResult.error) {
                  break;
                }

                lastError = generatedImageResult.error;

                if (attempt < MAX_RETRIES) {
                  const delay = Math.pow(2, attempt - 1) * 1000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              } catch (error) {
                lastError = error instanceof Error ? error.message : 'Processing failed';

                if (attempt < MAX_RETRIES) {
                  const delay = Math.pow(2, attempt - 1) * 1000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }

            if (generatedImageResult?.error || !generatedImageResult) {
              throw new Error(lastError || 'Sample image generation failed');
            }

            // Save the sample image record
            const [sampleImage] = await db
              .insert(generatedImages)
              .values({
                userId: user.id,
                generationId: null,
                originalImageId: sourceImage.id,
                scenario,
                prompt,
                s3Key: uploadData.s3Key,
                s3Url: uploadData.s3Url,
                geminiRequestId: generatedImageResult.requestId,
                isSample: true,
              })
              .returning();

            // Generate download URL
            const downloadUrlData = await s3Service.generateDownloadUrl(sampleImage.s3Key, 604800);

            return {
              ...sampleImage,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.error('Sample photo generation failed for image', {
              cognitoUserId: ctx.user.sub,
              imageId: sourceImage.id,
              scenario,
              error: error instanceof Error ? error.message : error,
            });
            throw error;
          }
        })
      );

      // Extract successful results
      const successfulSamples = generationResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const failedCount = generationResults.filter(result => result.status === 'rejected').length;

      logger.info('Sample photos generation completed', {
        cognitoUserId: ctx.user.sub,
        successCount: successfulSamples.length,
        failedCount,
      });

      return {
        success: successfulSamples.length > 0,
        alreadyExists: false,
        sampleImages: successfulSamples,
        failedCount,
      };
    }),

  // Get user's sample photos if they exist
  getSamplePhotos: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      const samplePhotos = await db
        .select()
        .from(generatedImages)
        .where(and(
          eq(generatedImages.userId, user.id),
          eq(generatedImages.isSample, true)
        ))
        .orderBy(desc(generatedImages.createdAt))
        .limit(3);

      if (samplePhotos.length === 0) {
        return [];
      }

      // Generate download URLs for all samples
      const photosWithUrls = await Promise.all(
        samplePhotos.map(async (photo) => {
          try {
            const downloadUrlData = await s3Service.generateDownloadUrl(photo.s3Key, 604800);
            return {
              ...photo,
              downloadUrl: downloadUrlData.downloadUrl,
            };
          } catch (error) {
            logger.warn('Failed to generate download URL for sample photo', {
              imageId: photo.id,
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
});