ALTER TABLE "runs" DROP CONSTRAINT "runs_ticket_id_unique";--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "local_day" text;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_ticket_generation" ON "runs" USING btree ("ticket_id","generation");
--> statement-breakpoint
UPDATE "runs" SET "local_day" = "tickets"."local_day" FROM "tickets" WHERE "tickets"."id" = "runs"."ticket_id";
