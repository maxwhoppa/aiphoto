import { getDb, closeDb } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Load environment variables
loadEnv({ path: path.join(__dirname, '..', '.env') });

async function applySchema() {
  console.log('🔄 Applying database schema fixes...');

  try {
    const db = getDb();

    // First, check if the generations table exists
    const genTableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'generations'
      );
    `);

    if (!genTableCheck[0]?.exists) {
      console.log('Creating generations table...');

      // Create the enum type first
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE generation_status AS ENUM ('in_progress', 'completed', 'failed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Create generations table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generations" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL,
          "payment_id" uuid,
          "generation_status" "generation_status" DEFAULT 'in_progress' NOT NULL,
          "total_images" integer NOT NULL,
          "completed_images" integer DEFAULT 0 NOT NULL,
          "scenarios" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "completed_at" timestamp,
          CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
          CONSTRAINT "generations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE set null
        );
      `);
      console.log('✅ Created generations table');
    }

    // Add generation_id column to generated_images if it doesn't exist
    console.log('Checking for generation_id column...');
    await db.execute(sql`
      ALTER TABLE "generated_images"
      ADD COLUMN IF NOT EXISTS "generation_id" uuid;
    `);

    // Add foreign key constraint
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "generated_images"
        ADD CONSTRAINT "generated_images_generation_id_generations_id_fk"
        FOREIGN KEY ("generation_id")
        REFERENCES "generations"("id")
        ON DELETE cascade;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add selected_profile_order column if it doesn't exist
    console.log('Checking for selected_profile_order column...');
    await db.execute(sql`
      ALTER TABLE "generated_images"
      ADD COLUMN IF NOT EXISTS "selected_profile_order" integer;
    `);

    // Add unique constraint for user profile order
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "generated_images"
        ADD CONSTRAINT "generated_images_user_id_selected_profile_order_unique"
        UNIQUE("user_id", "selected_profile_order");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Database schema applied successfully!');

  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the fix
applySchema();