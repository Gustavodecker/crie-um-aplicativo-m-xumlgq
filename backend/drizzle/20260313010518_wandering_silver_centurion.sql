ALTER TABLE "babies" ADD COLUMN "invite_code" text;--> statement-breakpoint
CREATE INDEX "babies_invite_code_idx" ON "babies" USING btree ("invite_code");--> statement-breakpoint
ALTER TABLE "babies" ADD CONSTRAINT "babies_invite_code_unique" UNIQUE("invite_code");