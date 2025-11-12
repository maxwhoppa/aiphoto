import { getDb, closeDb } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Load environment variables
loadEnv({ path: path.join(__dirname, '..', '.env') });

async function fixDatabaseSchema() {
  console.log('🔄 Fixing database schema...');

  try {
    const db = getDb();

    // Check if generation_id column exists
    console.log('📦 Checking generated_images table structure...');

    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'generated_images'
      AND column_name = 'generation_id'
    `);

    if (!result || result.length === 0) {
      console.log('⚠️  generation_id column not found, adding it...');

      // Add the generation_id column
      await db.execute(sql`
        ALTER TABLE "generated_images"
        ADD COLUMN IF NOT EXISTS "generation_id" uuid
      `);

      // Add the foreign key constraint
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "generated_images"
          ADD CONSTRAINT "generated_images_generation_id_generations_id_fk"
          FOREIGN KEY ("generation_id")
          REFERENCES "generations"("id")
          ON DELETE cascade ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$
      `);

      console.log('✅ generation_id column added successfully');
    } else {
      console.log('✅ generation_id column already exists');
    }

    // Also add selected_profile_order if it doesn't exist
    const profileOrderResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'generated_images'
      AND column_name = 'selected_profile_order'
    `);

    if (!profileOrderResult || profileOrderResult.length === 0) {
      console.log('⚠️  selected_profile_order column not found, adding it...');

      await db.execute(sql`
        ALTER TABLE "generated_images"
        ADD COLUMN IF NOT EXISTS "selected_profile_order" integer
      `);

      // Add unique constraint for user profile order
      await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "generated_images"
          ADD CONSTRAINT "generated_images_user_id_selected_profile_order_unique"
          UNIQUE("user_id", "selected_profile_order");
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$
      `);

      console.log('✅ selected_profile_order column added successfully');
    } else {
      console.log('✅ selected_profile_order column already exists');
    }

    console.log('✅ Database schema fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing database schema:', error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the fix
fixDatabaseSchema();