CREATE TABLE "inference_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_version" integer NOT NULL,
	"topic" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inference_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"rule_id" text NOT NULL,
	"topic" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"permission_revision" integer NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inferred_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"local_day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "allow_proactive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "proactive_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inference_observations" ADD CONSTRAINT "inference_observations_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_observations" ADD CONSTRAINT "inference_observations_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_watches" ADD CONSTRAINT "inference_watches_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_watches" ADD CONSTRAINT "inference_watches_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_publications" ADD CONSTRAINT "inferred_publications_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_publications" ADD CONSTRAINT "inferred_publications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_publications" ADD CONSTRAINT "inferred_publications_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inference_observation_source_rule" ON "inference_observations" USING btree ("source_message_id","rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inference_watch_source_rule" ON "inference_watches" USING btree ("source_message_id","rule_id");--> statement-breakpoint
CREATE INDEX "inference_watch_due" ON "inference_watches" USING btree ("state","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inferred_publication_cat_day" ON "inferred_publications" USING btree ("cat_id","local_day");--> statement-breakpoint
CREATE UNIQUE INDEX "inferred_publication_source" ON "inferred_publications" USING btree ("source_message_id");