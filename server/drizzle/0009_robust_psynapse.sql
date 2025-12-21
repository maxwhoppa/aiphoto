ALTER TABLE "user_images" ADD COLUMN "validation_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_images" ADD COLUMN "validation_warnings" text;--> statement-breakpoint
ALTER TABLE "user_images" ADD COLUMN "validated_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_images" ADD COLUMN "bypassed_at" timestamp;