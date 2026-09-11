CREATE TYPE "public"."memory_status" AS ENUM('active', 'superseded', 'conflicted');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'cat');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('done', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."memory_sensitivity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."turn_status" AS ENUM('queued', 'generating', 'completed', 'stopped', 'superseded', 'failed');--> statement-breakpoint
CREATE TABLE "boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boundaries_source_message_id_unique" UNIQUE("source_message_id")
);
--> statement-breakpoint
CREATE TABLE "cats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"appearance" text NOT NULL,
	"temperament" text NOT NULL,
	"traits" jsonb NOT NULL,
	"persona_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_cat_id_unique" UNIQUE("cat_id")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"predicate" text NOT NULL,
	"value" text NOT NULL,
	"confidence" real NOT NULL,
	"sensitivity" "memory_sensitivity" NOT NULL,
	"scope" text DEFAULT 'cat' NOT NULL,
	"status" "memory_status" DEFAULT 'active' NOT NULL,
	"explicit" boolean DEFAULT false NOT NULL,
	"fingerprint" text NOT NULL,
	"source_message_id" uuid NOT NULL,
	"extractor_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"text" text NOT NULL,
	"status" "message_status" DEFAULT 'done' NOT NULL,
	"client_message_id" text,
	"turn_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid,
	"job_id" text,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"cache_read_tokens" integer,
	"output_tokens" integer,
	"reasoning_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"input_version" integer NOT NULL,
	"status" "turn_status" DEFAULT 'queued' NOT NULL,
	"cat_message_id" uuid,
	"memory_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"model" text,
	"error" text,
	"started_at" timestamp with time zone,
	"first_token_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dev_token_hash" text,
	"apple_sub" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_dev_token_hash_unique" UNIQUE("dev_token_hash"),
	CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub")
);
--> statement-breakpoint
ALTER TABLE "boundaries" ADD CONSTRAINT "boundaries_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cats" ADD CONSTRAINT "cats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_blocks" ADD CONSTRAINT "memory_blocks_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memories_source_fingerprint" ON "memories" USING btree ("source_message_id","fingerprint");--> statement-breakpoint
CREATE INDEX "memories_cat_status" ON "memories" USING btree ("cat_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_blocks_cat_fingerprint" ON "memory_blocks" USING btree ("cat_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_id" ON "messages" USING btree ("conversation_id","client_message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_seq" ON "messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE INDEX "turns_conversation_status" ON "turns" USING btree ("conversation_id","status");