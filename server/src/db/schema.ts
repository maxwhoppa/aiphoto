import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoId: varchar('cognito_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const imageProcessingJobs = pgTable('image_processing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalImageUrl: text('original_image_url').notNull(),
  processedImageUrl: text('processed_image_url'),
  prompt: text('prompt').notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  geminiRequestId: varchar('gemini_request_id', { length: 255 }),
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userImages = pgTable('user_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  s3Key: varchar('s3_key', { length: 512 }).notNull(),
  s3Url: text('s3_url').notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  sizeBytes: varchar('size_bytes', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  imageProcessingJobs: many(imageProcessingJobs),
  userImages: many(userImages),
}));

export const imageProcessingJobsRelations = relations(imageProcessingJobs, ({ one }) => ({
  user: one(users, {
    fields: [imageProcessingJobs.userId],
    references: [users.id],
  }),
}));

export const userImagesRelations = relations(userImages, ({ one }) => ({
  user: one(users, {
    fields: [userImages.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect;
export type NewImageProcessingJob = typeof imageProcessingJobs.$inferInsert;
export type UserImage = typeof userImages.$inferSelect;
export type NewUserImage = typeof userImages.$inferInsert;