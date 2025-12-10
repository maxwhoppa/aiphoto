-- Rename stripe_session_id column to transaction_id in payments table
ALTER TABLE "payments" RENAME COLUMN "stripe_session_id" TO "transaction_id";