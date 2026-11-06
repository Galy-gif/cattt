CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"cat_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"day" text NOT NULL,
	"time" text NOT NULL,
	"cat_allowed" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"mutation_id" uuid NOT NULL,
	"visit" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diary_entries_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "diary_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "diary_source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "diary_cat_client" ON "diary_entries" USING btree ("cat_id","client_id");--> statement-breakpoint
CREATE INDEX "diary_cat_seq" ON "diary_entries" USING btree ("cat_id","seq");