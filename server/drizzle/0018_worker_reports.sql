CREATE TABLE "worker_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cat_id" uuid NOT NULL REFERENCES "cats"("id") ON DELETE CASCADE,
  "source_id" uuid NOT NULL,
  "version" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "worker_reports_source_version" ON "worker_reports" ("source_id", "version");
--> statement-breakpoint
CREATE FUNCTION cattt_notify_agent_work() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'pending' THEN
    PERFORM pg_notify('cattt_agent_wake', '');
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER async_jobs_wake AFTER INSERT OR UPDATE OF state, next_attempt_at ON async_jobs
FOR EACH ROW EXECUTE FUNCTION cattt_notify_agent_work();
