ALTER TABLE "babies" ADD COLUMN "token" text;--> statement-breakpoint
CREATE INDEX "babies_token_idx" ON "babies" USING btree ("token");--> statement-breakpoint
ALTER TABLE "babies" ADD CONSTRAINT "babies_token_unique" UNIQUE("token");