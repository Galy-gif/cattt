ALTER TABLE "diary_calendars" ADD COLUMN "next_day" text;--> statement-breakpoint
ALTER TABLE "diary_calendars" ADD COLUMN "next_scan_at" timestamp with time zone DEFAULT 'epoch'::timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "change_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "diary_calendar_due" ON "diary_calendars" USING btree ("next_scan_at","cat_id");--> statement-breakpoint
CREATE SEQUENCE diary_change_seq OWNED BY diary_entries.change_seq;
--> statement-breakpoint
UPDATE diary_entries SET change_seq = nextval('diary_change_seq');
--> statement-breakpoint
CREATE INDEX "diary_cat_change" ON "diary_entries" USING btree ("cat_id","change_seq");
--> statement-breakpoint
-- 同一只猫按提交次序分配游标。旧版本的写入、阅读回执与权限撤回也经过这里。
CREATE FUNCTION assign_diary_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM cats WHERE id = NEW.cat_id FOR NO KEY UPDATE;
  NEW.change_seq := nextval('diary_change_seq');
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER diary_change BEFORE INSERT OR UPDATE ON diary_entries
FOR EACH ROW EXECUTE FUNCTION assign_diary_change();
--> statement-breakpoint
UPDATE diary_calendars SET next_day = start_day;
--> statement-breakpoint
INSERT INTO diary_calendars(cat_id, start_day)
SELECT c.id, to_char(c.created_at AT TIME ZONE u.time_zone, 'YYYY-MM-DD')
FROM cats c JOIN users u ON u.id = c.user_id ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION register_diary_calendar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO diary_calendars(cat_id, start_day)
  SELECT NEW.id, to_char(NEW.created_at AT TIME ZONE time_zone, 'YYYY-MM-DD') FROM users WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER cat_diary_calendar AFTER INSERT ON cats FOR EACH ROW EXECUTE FUNCTION register_diary_calendar();
--> statement-breakpoint
CREATE FUNCTION wake_diary_calendar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE diary_calendars SET next_scan_at = 'epoch' WHERE cat_id IN (SELECT id FROM cats WHERE user_id = NEW.id);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER diary_zone_changed AFTER UPDATE OF time_zone ON users
FOR EACH ROW WHEN (OLD.time_zone IS DISTINCT FROM NEW.time_zone) EXECUTE FUNCTION wake_diary_calendar();
