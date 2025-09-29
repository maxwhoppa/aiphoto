CREATE TABLE IF NOT EXISTS "generated_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_image_id" uuid NOT NULL,
	"scenario" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"s3_key" varchar(512) NOT NULL,
	"s3_url" text NOT NULL,
	"gemini_request_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_session_id" varchar(255) NOT NULL,
	"amount" varchar(20) NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"redeemed" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"redeemed_at" timestamp,
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"prompt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scenarios_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DROP TABLE "image_processing_jobs";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_original_image_id_user_images_id_fk" FOREIGN KEY ("original_image_id") REFERENCES "user_images"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_s3_key_unique" UNIQUE("user_id","s3_key");