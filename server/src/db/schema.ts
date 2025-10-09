import { pgTable, uuid, varchar, timestamp, text, boolean, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoId: varchar('cognito_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
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
}, (table) => ({
  uniqueUserS3Key: unique().on(table.userId, table.s3Key),
}));

export const generatedImages = pgTable('generated_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalImageId: uuid('original_image_id').notNull().references(() => userImages.id, { onDelete: 'cascade' }),
  scenario: varchar('scenario', { length: 100 }).notNull(),
  prompt: text('prompt').notNull(),
  s3Key: varchar('s3_key', { length: 512 }).notNull(),
  s3Url: text('s3_url').notNull(),
  geminiRequestId: varchar('gemini_request_id', { length: 255 }),
  selectedProfileOrder: integer('selected_profile_order'), // 1-6 for selected profile photos
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
  stripeSessionId: varchar('stripe_session_id', { length: 255 }).notNull().unique(),
  amount: varchar('amount', { length: 20 }).notNull(), // Amount in cents as string
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  redeemed: boolean('redeemed').notNull().default(false), // Has the user used this payment to generate photos
  paidAt: timestamp('paid_at').notNull().defaultNow(), // When payment was confirmed by Stripe
  redeemedAt: timestamp('redeemed_at'), // When user generated photos using this payment
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userImages: many(userImages),
  generatedImages: many(generatedImages),
  payments: many(payments),
}));

export const userImagesRelations = relations(userImages, ({ one, many }) => ({
  user: one(users, {
    fields: [userImages.userId],
    references: [users.id],
  }),
  generatedImages: many(generatedImages),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  user: one(users, {
    fields: [generatedImages.userId],
    references: [users.id],
  }),
  originalImage: one(userImages, {
    fields: [generatedImages.originalImageId],
    references: [userImages.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserImage = typeof userImages.$inferSelect;
export type NewUserImage = typeof userImages.$inferInsert;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type NewGeneratedImage = typeof generatedImages.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;