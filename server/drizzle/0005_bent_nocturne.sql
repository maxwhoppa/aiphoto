DO $$ BEGIN
 CREATE TYPE "generation_status" AS ENUM('in_progress', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "generation_status" "generation_status";