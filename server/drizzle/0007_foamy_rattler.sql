ALTER TABLE "payments" RENAME COLUMN "stripe_session_id" TO "transaction_id";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_stripe_session_id_unique";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_id_unique" UNIQUE("transaction_id");