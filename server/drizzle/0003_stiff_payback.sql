CREATE TABLE "soul_blocked_sources" (
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soul_blocked_sources" ADD CONSTRAINT "soul_blocked_sources_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "soul_blocked_cat_source" ON "soul_blocked_sources" USING btree ("cat_id","source_message_id");