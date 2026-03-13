ALTER TABLE "babies" DROP CONSTRAINT "babies_token_unique";--> statement-breakpoint
DROP INDEX "babies_token_idx";--> statement-breakpoint
ALTER TABLE "babies" DROP COLUMN "token";