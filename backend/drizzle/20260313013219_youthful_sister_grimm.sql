ALTER TABLE "babies" DROP CONSTRAINT IF EXISTS "babies_invite_code_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "babies_invite_code_idx";--> statement-breakpoint
ALTER TABLE "babies" DROP COLUMN IF EXISTS "invite_code";