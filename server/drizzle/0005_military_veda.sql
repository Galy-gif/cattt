ALTER TABLE "cats" ADD COLUMN "learn_memories" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "use_memories" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "memory_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "learn_after_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "edited_through_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "context_allowed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "memory_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "context_source_ids" uuid[];--> statement-breakpoint
ALTER TABLE "turns" ADD COLUMN "context_revision" integer;
--> statement-breakpoint
-- 来源归属不完整的旧条目不作为事实注入；不清库、不恢复已删除内容。
UPDATE memories m SET status = 'conflicted' WHERE NOT EXISTS (
 SELECT 1 FROM messages s JOIN conversations c ON c.id = s.conversation_id
 WHERE s.id = m.source_message_id AND s.role = 'user' AND c.cat_id = m.cat_id
);
