import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { turns } from './schema.ts';

export const runtimeCalls = pgTable('runtime_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  turnId: uuid('turn_id').notNull().references(() => turns.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(),
  callId: text('call_id').notNull(),
  tool: text('tool').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [uniqueIndex('runtime_calls_turn_step_call').on(t.turnId, t.step, t.callId)]);

export const runtimeSteps = pgTable('runtime_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  turnId: uuid('turn_id').notNull().references(() => turns.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(),
  phase: text('phase').notNull(),
  finishReason: text('finish_reason').notNull(),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('runtime_steps_turn_step').on(t.turnId, t.step)]);
