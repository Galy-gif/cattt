CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"messages" jsonb NOT NULL,
	"usage" jsonb NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"report" jsonb DEFAULT '{"calls":{},"dependencies":{"messages":[],"diaries":[],"usedMemories":false},"freshRetries":0}'::jsonb NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"elapsed_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_ticket_id_unique" UNIQUE("ticket_id"),
	CONSTRAINT "runs_status" CHECK ("runs"."status" in ('pending','running','ended'))
);
--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_checkpoint" ON "run_steps" USING btree ("run_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_one_running" ON "runs" USING btree ("ticket_id") WHERE "runs"."status" = 'running';