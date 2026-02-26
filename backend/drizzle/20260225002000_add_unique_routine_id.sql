-- First, delete duplicate night_sleep records, keeping only the most recent one per routineId
DELETE FROM "night_sleep" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "routine_id" ORDER BY "created_at" DESC) as rn
    FROM "night_sleep"
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint to routineId
ALTER TABLE "night_sleep" ADD CONSTRAINT "night_sleep_routine_id_unique" UNIQUE ("routine_id");
