CREATE TABLE "diary_calendars" (
	"cat_id" uuid PRIMARY KEY NOT NULL,
	"start_day" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"local_day" text NOT NULL,
	"time_zone" text NOT NULL,
	"fingerprint" text NOT NULL,
	"text" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_calendars" ADD CONSTRAINT "diary_calendars_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_facts" ADD CONSTRAINT "diary_facts_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "diary_facts_day_identity" ON "diary_facts" USING btree ("cat_id","local_day","fingerprint");--> statement-breakpoint
INSERT INTO proactive_rules (rule_id, version, text, mode) VALUES ('daily_diary', 1, '每天为上一完整本地日写猫日记，只进信箱', 'auto') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO diary_calendars (cat_id, start_day) SELECT c.id, to_char(now() AT TIME ZONE u.time_zone, 'YYYY-MM-DD') FROM cats c JOIN users u ON u.id=c.user_id ON CONFLICT DO NOTHING;
