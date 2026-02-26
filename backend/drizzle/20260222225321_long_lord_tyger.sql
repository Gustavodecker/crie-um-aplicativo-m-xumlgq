CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "babies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"birth_date" date NOT NULL,
	"mother_name" text NOT NULL,
	"mother_phone" text NOT NULL,
	"mother_email" text NOT NULL,
	"mother_user_id" text,
	"consultant_id" uuid NOT NULL,
	"objectives" text,
	"conclusion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"photo" text,
	"logo" text,
	"primary_color" text DEFAULT '#6B4CE6',
	"secondary_color" text DEFAULT '#9D7FEA',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultants_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baby_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"duration_days" integer NOT NULL,
	"status" text NOT NULL,
	"contract_pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baby_id" uuid NOT NULL,
	"date" date NOT NULL,
	"wake_up_time" text NOT NULL,
	"mother_observations" text,
	"consultant_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "naps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"nap_number" integer NOT NULL,
	"start_try_time" text NOT NULL,
	"fell_asleep_time" text,
	"wake_up_time" text,
	"sleep_method" text,
	"environment" text,
	"wake_up_mood" text,
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_sleep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"start_try_time" text NOT NULL,
	"fell_asleep_time" text,
	"final_wake_time" text,
	"sleep_method" text,
	"environment" text,
	"wake_up_mood" text,
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "night_wakings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"night_sleep_id" uuid NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orientations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baby_id" uuid NOT NULL,
	"date" date NOT NULL,
	"orientation_text" text NOT NULL,
	"results" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_windows_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_id" uuid NOT NULL,
	"age_months_min" integer NOT NULL,
	"age_months_max" integer NOT NULL,
	"window_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "babies" ADD CONSTRAINT "babies_mother_user_id_user_id_fk" FOREIGN KEY ("mother_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "babies" ADD CONSTRAINT "babies_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_routines" ADD CONSTRAINT "daily_routines_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "naps" ADD CONSTRAINT "naps_routine_id_daily_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."daily_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_sleep" ADD CONSTRAINT "night_sleep_routine_id_daily_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."daily_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_wakings" ADD CONSTRAINT "night_wakings_night_sleep_id_night_sleep_id_fk" FOREIGN KEY ("night_sleep_id") REFERENCES "public"."night_sleep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orientations" ADD CONSTRAINT "orientations_baby_id_babies_id_fk" FOREIGN KEY ("baby_id") REFERENCES "public"."babies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_windows_config" ADD CONSTRAINT "sleep_windows_config_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "babies_consultant_id_idx" ON "babies" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "babies_mother_user_id_idx" ON "babies" USING btree ("mother_user_id");--> statement-breakpoint
CREATE INDEX "contracts_baby_id_idx" ON "contracts" USING btree ("baby_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_routines_baby_date_idx" ON "daily_routines" USING btree ("baby_id","date");--> statement-breakpoint
CREATE INDEX "daily_routines_baby_id_idx" ON "daily_routines" USING btree ("baby_id");--> statement-breakpoint
CREATE INDEX "naps_routine_id_idx" ON "naps" USING btree ("routine_id");--> statement-breakpoint
CREATE INDEX "night_sleep_routine_id_idx" ON "night_sleep" USING btree ("routine_id");--> statement-breakpoint
CREATE INDEX "night_wakings_night_sleep_id_idx" ON "night_wakings" USING btree ("night_sleep_id");--> statement-breakpoint
CREATE INDEX "orientations_baby_id_idx" ON "orientations" USING btree ("baby_id");--> statement-breakpoint
CREATE INDEX "sleep_windows_config_consultant_id_idx" ON "sleep_windows_config" USING btree ("consultant_id");