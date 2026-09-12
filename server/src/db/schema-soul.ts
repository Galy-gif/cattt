import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { cats, messages, turns } from './schema.ts';
import type { SoulEntry, RuntimeState, Personality } from '../soul/rules.ts';

export const personalityVersions = pgTable('personality_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  profile: jsonb('profile').$type<Personality>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('personality_cat_version').on(t.catId, t.version)]);

export const soulVersions = pgTable('soul_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  parentVersion: integer('parent_version'),
  personaVersion: integer('persona_version').notNull(),
  entries: jsonb('entries').$type<SoulEntry[]>().notNull(),
  markdown: text('markdown').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('soul_cat_version').on(t.catId, t.version)]);

export const runtimeEvents = pgTable('cat_runtime_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  sourceMessageId: uuid('source_message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  state: jsonb('state').$type<RuntimeState>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('runtime_event_cat_source').on(t.catId, t.sourceMessageId)]);

export const catRuntimeStates = pgTable('cat_runtime_states', {
  catId: uuid('cat_id').primaryKey().references(() => cats.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(0),
  state: jsonb('state').$type<RuntimeState>().notNull(),
});

export const turnSoulSnapshots = pgTable('turn_soul_snapshots', {
  turnId: uuid('turn_id').primaryKey().references(() => turns.id, { onDelete: 'cascade' }),
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  personaVersion: integer('persona_version').notNull(),
  soulVersion: integer('soul_version').notNull(),
  runtimeVersion: integer('runtime_version').notNull(),
  boundaryIds: uuid('boundary_ids').array().notNull(),
  state: jsonb('state').$type<RuntimeState>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 撤回后仅留来源 ID，阻止同一事件重试恢复已删除的成长/状态。 */
export const soulBlockedSources = pgTable('soul_blocked_sources', {
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  sourceMessageId: uuid('source_message_id').notNull(),
}, t => [uniqueIndex('soul_blocked_cat_source').on(t.catId, t.sourceMessageId)]);
