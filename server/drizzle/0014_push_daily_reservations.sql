CREATE TABLE "push_budget_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_budget_reservations" ADD CONSTRAINT "push_budget_reservations_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_budget_reservations" ADD CONSTRAINT "push_budget_reservations_notification_id_push_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."push_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_budget_day_notification" ON "push_budget_reservations" USING btree ("notification_id","day");--> statement-breakpoint
CREATE INDEX "push_budget_cat_day" ON "push_budget_reservations" USING btree ("cat_id","day");