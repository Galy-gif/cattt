CREATE TABLE "async_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"source_id" uuid NOT NULL,
	"object_id" uuid NOT NULL,
	"version" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"error" text,
	"remembered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_receipts" (
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"accepted" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"turn_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"generation" uuid NOT NULL,
	"destination_id" text NOT NULL,
	"state_version" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accept_before" timestamp with time zone NOT NULL,
	"finish_before" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	"state_version" integer DEFAULT -1 NOT NULL,
	"snapshot" jsonb,
	"observed_at" timestamp with time zone,
	"online_until" timestamp with time zone,
	CONSTRAINT "world_sessions_cat_id_unique" UNIQUE("cat_id")
);
--> statement-breakpoint
CREATE TABLE "cat_runtime_states" (
	"cat_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personality_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cat_runtime_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soul_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"parent_version" integer,
	"persona_version" integer NOT NULL,
	"entries" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn_soul_snapshots" (
	"turn_id" uuid PRIMARY KEY NOT NULL,
	"cat_id" uuid NOT NULL,
	"persona_version" integer NOT NULL,
	"soul_version" integer NOT NULL,
	"runtime_version" integer NOT NULL,
	"boundary_ids" uuid[] NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"call_id" text NOT NULL,
	"tool" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runtime_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"phase" text NOT NULL,
	"finish_reason" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory_blocks" ADD COLUMN "source_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_receipts" ADD CONSTRAINT "memory_receipts_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_actions" ADD CONSTRAINT "world_actions_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_actions" ADD CONSTRAINT "world_actions_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_actions" ADD CONSTRAINT "world_actions_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_sessions" ADD CONSTRAINT "world_sessions_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cat_runtime_states" ADD CONSTRAINT "cat_runtime_states_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_versions" ADD CONSTRAINT "personality_versions_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cat_runtime_events" ADD CONSTRAINT "cat_runtime_events_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cat_runtime_events" ADD CONSTRAINT "cat_runtime_events_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soul_versions" ADD CONSTRAINT "soul_versions_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_soul_snapshots" ADD CONSTRAINT "turn_soul_snapshots_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_soul_snapshots" ADD CONSTRAINT "turn_soul_snapshots_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_calls" ADD CONSTRAINT "runtime_calls_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_steps" ADD CONSTRAINT "runtime_steps_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "async_jobs_source_kind_version" ON "async_jobs" USING btree ("source_id","kind","version");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_receipts_source_fingerprint" ON "memory_receipts" USING btree ("source_message_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "world_actions_message" ON "world_actions" USING btree ("user_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personality_cat_version" ON "personality_versions" USING btree ("cat_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_event_cat_source" ON "cat_runtime_events" USING btree ("cat_id","source_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "soul_cat_version" ON "soul_versions" USING btree ("cat_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_calls_turn_step_call" ON "runtime_calls" USING btree ("turn_id","step","call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runtime_steps_turn_step" ON "runtime_steps" USING btree ("turn_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_cat_turn" ON "messages" USING btree ("turn_id") WHERE "messages"."role" = 'cat';