import { pgTable, uuid, varchar, timestamp, text, boolean, integer, unique, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for generation status
export const generationStatusEnum = pgEnum('generation_status', ['in_progress', 'completed', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoId: varchar('cognito_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
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
  // Validation fields
  validationStatus: text('validation_status').notNull().default('pending'), // 'pending' | 'validated' | 'failed' | 'bypassed'
  validationWarnings: text('validation_warnings'), // JSON array: ['multiple_people', 'face_covered_or_blurred', 'poor_lighting']
  validatedAt: timestamp('validated_at'),
  bypassedAt: timestamp('bypassed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueUserS3Key: unique().on(table.userId, table.s3Key),
}));

export const generations = pgTable('generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }), // Optional payment reference
  generationStatus: generationStatusEnum('generation_status').notNull().default('in_progress'),
  totalImages: integer('total_images').notNull(), // Total number of images to generate
  completedImages: integer('completed_images').notNull().default(0), // Number of images completed so far
  scenarios: text('scenarios').notNull(), // JSON array of scenario names
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'), // When generation finished (success or failure)
});

export const generatedImages = pgTable('generated_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  generationId: uuid('generation_id').references(() => generations.id, { onDelete: 'cascade' }), // Nullable for legacy images
  originalImageId: uuid('original_image_id').notNull().references(() => userImages.id, { onDelete: 'cascade' }),
  scenario: varchar('scenario', { length: 100 }).notNull(),
  prompt: text('prompt').notNull(),
  s3Key: varchar('s3_key', { length: 512 }).notNull(),
  s3Url: text('s3_url').notNull(),
  geminiRequestId: varchar('gemini_request_id', { length: 255 }),
  selectedProfileOrder: integer('selected_profile_order'), // 1-6 for selected profile photos
  isSample: boolean('is_sample').notNull().default(false), // True for preview sample photos
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Ensure only one photo per order position per user
  uniqueUserProfileOrder: unique().on(table.userId, table.selectedProfileOrder),
}));

export const scenarios = pgTable('scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transactionId: varchar('transaction_id', { length: 255 }).notNull().unique(),
  amount: varchar('amount', { length: 20 }).notNull(), // Amount in cents as string
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  redeemed: boolean('redeemed').notNull().default(false), // Has the user used this payment to generate photos
  paidAt: timestamp('paid_at').notNull().defaultNow(), // When payment was confirmed
  redeemedAt: timestamp('redeemed_at'), // When user generated photos using this payment
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userImages: many(userImages),
  generatedImages: many(generatedImages),
  generations: many(generations),
  payments: many(payments),
}));

export const userImagesRelations = relations(userImages, ({ one, many }) => ({
  user: one(users, {
    fields: [userImages.userId],
    references: [users.id],
  }),
  generatedImages: many(generatedImages),
}));

export const generationsRelations = relations(generations, ({ one, many }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [generations.paymentId],
    references: [payments.id],
  }),
  generatedImages: many(generatedImages),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  user: one(users, {
    fields: [generatedImages.userId],
    references: [users.id],
  }),
  generation: one(generations, {
    fields: [generatedImages.generationId],
    references: [generations.id],
  }),
  originalImage: one(userImages, {
    fields: [generatedImages.originalImageId],
    references: [userImages.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  generations: many(generations),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserImage = typeof userImages.$inferSelect;
export type NewUserImage = typeof userImages.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type NewGeneratedImage = typeof generatedImages.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// Validation types
export type ValidationStatus = 'pending' | 'validated' | 'failed' | 'bypassed';
export type ValidationWarning = 'multiple_people' | 'face_covered_or_blurred' | 'poor_lighting' | 'is_screenshot' | 'face_partially_covered';