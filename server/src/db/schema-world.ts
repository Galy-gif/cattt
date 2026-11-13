import { integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, text } from 'drizzle-orm/pg-core';
import { cats, messages, turns } from './schema.ts';
import type { ActionStatus, WorldSnapshot } from '../world/protocol.ts';

export const worldSessions = pgTable('world_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  catId: uuid('cat_id').notNull().unique().references(() => cats.id, { onDelete: 'cascade' }),
  generation: uuid('generation').notNull().defaultRandom(),
  stateVersion: integer('state_version').notNull().default(-1),
  snapshot: jsonb('snapshot').$type<WorldSnapshot>(),
  observedAt: timestamp('observed_at', { withTimezone: true }),
  onlineUntil: timestamp('online_until', { withTimezone: true }),
});
export const worldActions = pgTable('world_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  turnId: uuid('turn_id').notNull().references(() => turns.id, { onDelete: 'cascade' }),
  userMessageId: uuid('user_message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull(),
  generation: uuid('generation').notNull(),
  destinationId: text('destination_id').notNull(),
  activity: text('activity').$type<'sit'>(),
  stateVersion: integer('state_version').notNull(),
  status: text('status').$type<ActionStatus>().notNull().default('requested'),
  reason: text('reason'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  acceptBefore: timestamp('accept_before', { withTimezone: true }).notNull(),
  finishBefore: timestamp('finish_before', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('world_actions_message').on(t.userMessageId)]);
