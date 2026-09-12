import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  devTokenHash: text('dev_token_hash').unique(),
  /** 以后接 Sign in with Apple 时填 */
  appleSub: text('apple_sub').unique(),
  name: text('name'),
  createdAt: createdAt(),
});

/** 四条特征的档位：0 低 / 1 中 / 2 高 */
export type Traits = { energy: number; initiative: number; directness: number; closeness: number };

export const cats = pgTable('cats', {
  id: id(),
  /** 开发者版一人一猫 */
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  appearance: text('appearance').notNull(),
  temperament: text('temperament').notNull(),
  traits: jsonb('traits').$type<Traits>().notNull(),
  /** 改性格时 +1，只影响之后的表达 */
  personaVersion: integer('persona_version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: id(),
  /** 开发者版一只猫一段连续对话 */
  catId: uuid('cat_id').notNull().unique().references(() => cats.id, { onDelete: 'cascade' }),
  /** 每来一条用户消息 +1，新鲜度复核用 */
  version: integer('version').notNull().default(0),
  createdAt: createdAt(),
});

export const messageRole = pgEnum('message_role', ['user', 'cat']);
export const messageStatus = pgEnum('message_status', ['done', 'stopped']);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    /** 排序和翻页用 */
    seq: bigserial('seq', { mode: 'number' }).notNull().unique(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRole('role').notNull(),
    text: text('text').notNull(),
    status: messageStatus('status').notNull().default('done'),
    /** 客户端生成的 id，发送失败重试不会存两条；猫的消息为空 */
    clientMessageId: text('client_message_id'),
    /** 猫的消息属于哪一轮 */
    turnId: uuid('turn_id'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('messages_client_id').on(t.conversationId, t.clientMessageId),
    index('messages_conversation_seq').on(t.conversationId, t.seq),
    uniqueIndex('messages_cat_turn').on(t.turnId).where(sql`${t.role} = 'cat'`),
  ],
);

export const turnStatus = pgEnum('turn_status', [
  'queued',
  'generating',
  'completed',
  'stopped',
  'superseded',
  'failed',
]);

export const turns = pgTable(
  'turns',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userMessageId: uuid('user_message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    /** 建这一轮时的 conversation.version */
    inputVersion: integer('input_version').notNull(),
    status: turnStatus('status').notNull().default('queued'),
    catMessageId: uuid('cat_message_id'),
    /** 这一轮注入了哪些记忆 */
    memoryIds: uuid('memory_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    model: text('model'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    firstTokenAt: timestamp('first_token_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    /** worker 提取完记忆的时间；iOS 轮询「记下了」看它 */
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    /** 这一轮用户明确要记的内容记下了（新写入或确认了已有的） */
    remembered: boolean('remembered').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('turns_conversation_status').on(t.conversationId, t.status)],
);

export const modelCalls = pgTable('model_calls', {
  id: id(),
  turnId: uuid('turn_id'),
  jobId: text('job_id'),
  /** chat / memory_extract / boundary_summarize */
  purpose: text('purpose').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  cacheReadTokens: integer('cache_read_tokens'),
  outputTokens: integer('output_tokens'),
  reasoningTokens: integer('reasoning_tokens'),
  latencyMs: integer('latency_ms'),
  createdAt: createdAt(),
});

export const sensitivity = pgEnum('memory_sensitivity', ['low', 'medium', 'high']);
export const memoryStatus = pgEnum('memory_status', ['active', 'superseded', 'conflicted']);

export const memories = pgTable(
  'memories',
  {
    id: id(),
    catId: uuid('cat_id')
      .notNull()
      .references(() => cats.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    value: text('value').notNull(),
    confidence: real('confidence').notNull(),
    sensitivity: sensitivity('sensitivity').notNull(),
    scope: text('scope').notNull().default('cat'),
    status: memoryStatus('status').notNull().default('active'),
    /** 用户明确说了「记住」 */
    explicit: boolean('explicit').notNull().default(false),
    /** subject + predicate 归一化后的哈希；阻断和冲突判断都按它 */
    fingerprint: text('fingerprint').notNull(),
    sourceMessageId: uuid('source_message_id').notNull(),
    extractorVersion: text('extractor_version').notNull(),
    createdAt: createdAt(),
    lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 同一条来源消息重复提取不会写两遍
    uniqueIndex('memories_source_fingerprint').on(t.sourceMessageId, t.fingerprint),
    index('memories_cat_status').on(t.catId, t.status),
  ],
);

/** 删掉记忆后留下的阻断记录，只有指纹，没有原文 */
export const memoryBlocks = pgTable(
  'memory_blocks',
  {
    id: id(),
    catId: uuid('cat_id')
      .notNull()
      .references(() => cats.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    sourceSeq: integer('source_seq').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('memory_blocks_cat_fingerprint').on(t.catId, t.fingerprint)],
);

/** 「不要再提」 */
export const boundaries = pgTable('boundaries', {
  id: id(),
  catId: uuid('cat_id')
    .notNull()
    .references(() => cats.id, { onDelete: 'cascade' }),
  sourceMessageId: uuid('source_message_id').notNull().unique(),
  /** worker 从那条消息整理出的一句话；整理好之前为空，先用原文 */
  description: text('description'),
  createdAt: createdAt(),
});

/** PG 是异步任务的真相源，Redis 只是可重建的投递通道。 */
export const asyncJobs = pgTable('async_jobs', {
  id: id(),
  kind: text('kind').notNull(),
  sourceId: uuid('source_id').notNull(),
  objectId: uuid('object_id').notNull(),
  version: text('version').notNull(),
  state: text('state').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  error: text('error'),
  remembered: boolean('remembered').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('async_jobs_source_kind_version').on(t.sourceId, t.kind, t.version)]);

/** 即使候选仅确认已有记忆，也保存来源凭证，重放不能再次改变状态。 */
export const memoryReceipts = pgTable('memory_receipts', {
  catId: uuid('cat_id').notNull().references(() => cats.id, { onDelete: 'cascade' }),
  sourceMessageId: uuid('source_message_id').notNull(),
  fingerprint: text('fingerprint').notNull(),
  accepted: boolean('accepted').notNull(),
}, (t) => [uniqueIndex('memory_receipts_source_fingerprint').on(t.sourceMessageId, t.fingerprint)]);

export * from './schema-world.ts';
export * from './schema-soul.ts';
export * from './schema-runtime.ts';
