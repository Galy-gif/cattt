CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"ticket_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_outcome" CHECK ("decisions"."outcome" in ('accept','attach','ignore','silent'))
);
--> statement-breakpoint
CREATE TABLE "mailbox_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"cat_id" uuid NOT NULL,
	"ticket_id" uuid,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "mailbox_letters_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"cat_id" uuid NOT NULL,
	"ticket_id" uuid,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dropped_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_seq_unique" UNIQUE("seq"),
	CONSTRAINT "outbox_kind" CHECK ("outbox"."kind" in ('chat_message','mailbox_letter','push')),
	CONSTRAINT "outbox_status" CHECK ("outbox"."status" in ('pending','sent','dropped'))
);
--> statement-breakpoint
CREATE TABLE "proactive_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" text NOT NULL,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"mode" text NOT NULL,
	CONSTRAINT "proactive_rules_mode" CHECK ("proactive_rules"."mode" in ('off','observe','auto'))
);
--> statement-breakpoint
CREATE TABLE "ticket_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"message_id" uuid,
	"text" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"goal" text NOT NULL,
	"mandate" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"stage" text DEFAULT 'scheduled' NOT NULL,
	"due_at" timestamp with time zone,
	"time_zone" text,
	"local_day" text,
	"source_message_id" uuid,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_kind" CHECK ("tickets"."kind" in ('followup','errand','diary')),
	CONSTRAINT "tickets_status" CHECK ("tickets"."status" in ('open','ended'))
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cat_id" uuid NOT NULL,
	"source" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_trigger_id_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_letters" ADD CONSTRAINT "mailbox_letters_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_letters" ADD CONSTRAINT "mailbox_letters_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inputs" ADD CONSTRAINT "ticket_inputs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_inputs" ADD CONSTRAINT "ticket_inputs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_cat_id_cats_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mailbox_cat_seq" ON "mailbox_letters" USING btree ("cat_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_ticket_purpose" ON "outbox" USING btree ("ticket_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "proactive_rules_version" ON "proactive_rules" USING btree ("rule_id","version");--> statement-breakpoint
CREATE INDEX "tickets_due" ON "tickets" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_diary_day" ON "tickets" USING btree ("cat_id","local_day") WHERE "tickets"."kind" = 'diary';--> statement-breakpoint
CREATE UNIQUE INDEX "triggers_identity" ON "triggers" USING btree ("cat_id","source","idempotency_key");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO proactive_rules (rule_id, version, text, mode) VALUES
('followup_due',1,'用户亲口约定到期，始终生效；只决定措辞与合并，不否决发送','auto'),
('errand_result',1,'用户亲口托付的结果；第三段启用','auto'),
('daily_diary',1,'每天写猫自己的日记；第四段启用','auto'),
('ask_outcome',1,'用户近期重要的事，事后问结果；仅观察','observe'),
('quiet_return',1,'久未来访后的低优先招呼；关闭','off');
