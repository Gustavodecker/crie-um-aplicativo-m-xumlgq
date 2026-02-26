DROP INDEX "night_sleep_routine_id_idx";--> statement-breakpoint
CREATE INDEX "night_sleep_routine_id_idx" ON "night_sleep" USING btree ("routine_id");