import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { db, type Tx } from "../db/client.ts";
import {
  asyncJobs,
  cats,
  conversations,
  decisions,
  inferenceObservations,
  inferenceWatches,
  inferredPublications,
  messages,
  proactiveRules,
  tickets,
  triggers,
  users,
} from "../db/schema.ts";
import { config } from "../config.ts";
import { lockMemory } from "../memory/control.ts";
import { recallPermissions } from "../memory/recall.ts";
import { overlapsBoundaries } from "./gate.ts";
import { availableAt, localISO, parseFollowupTime } from "./tickets.ts";
import {
  acquireConversationLock,
  releaseConversationLock,
} from "../turns/events.ts";
import { assessOutcome, reviewOutcome } from "./inference-router.ts";
import { publishInferredFollowup } from "./publisher.ts";
export const outcomeTopics = {
  interview: "面试",
  exam: "考试",
  medical: "就诊",
  competition: "比赛",
  defense: "答辩",
} as const;
export type OutcomeTopic = keyof typeof outcomeTopics;
const topicWords: Record<OutcomeTopic, RegExp> = {
  interview: /面试/,
  exam: /考试|考完/,
  medical: /就诊|看医生|手术/,
  competition: /比赛/,
  defense: /答辩/,
};
const resultWords =
  /通过|没过|过了|顺利|失败|不顺|结果是|结果出来|结束了.*感觉|赢了|输了|拿到了|没拿到|已经好了|没事了|医生说|考得|发挥得|发挥不好/;
export const sourceHash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const item = (text: string) => ({
  id: "",
  subject: "",
  predicate: "",
  value: text,
  fingerprint: "",
  explicit: true,
  sensitivity: "low",
  lastConfirmedAt: new Date(0),
  revision: 0,
});
export function outcomeTopic(text: string): OutcomeTopic | undefined {
  return (Object.keys(topicWords) as OutcomeTopic[]).find((t) =>
    topicWords[t].test(text),
  );
}
export function isOutcome(text: string, topic: OutcomeTopic) {
  return topicWords[topic].test(text) && resultWords.test(text);
}
/** 只接明确的结束时刻；不从“明天面试”猜面试时长。近期边界为来源后7天。 */
export function outcomeEvent(text: string, at: Date, zone: string) {
  const topic = outcomeTopic(text);
  if (!topic) return undefined;
  const ending = "(?:结束|出结果|考完|面试完|比赛完|就诊完|答辩完)";
  const iso = text.match(
    new RegExp(
      `(\\d{4}-\\d\\d-\\d\\d[T ]\\d\\d:\\d\\d(?::\\d\\d(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d\\d:\\d\\d)?)(?![\\d:.+Z-])[^。！？\\n]{0,24}?${ending}`,
    ),
  );
  let afterAt: Date | undefined, timeQuote: string | undefined;
  try {
    if (iso) {
      afterAt = parseFollowupTime(iso[1]!.replace(" ", "T"), zone);
      timeQuote = iso[0];
    } else {
      const relative = text.match(
        new RegExp(
          `(今天|明天|后天)(?:的)?(上午|下午|晚上|中午)?(\\d{1,2})(?::(\\d{2})|点(?:(\\d{1,2})分|半)?)[^。！？\\n]{0,24}?${ending}`,
        ),
      );
      if (relative) {
        const day = localISO(at, zone).slice(0, 10);
        const shift =
          relative[1] === "明天" ? 1 : relative[1] === "后天" ? 2 : 0;
        const date = new Date(Date.parse(day + "T12:00:00Z") + shift * 86400000)
          .toISOString()
          .slice(0, 10);
        let hour = Number(relative[3]);
        if (["下午", "晚上", "中午"].includes(relative[2] ?? "") && hour < 12)
          hour += 12;
        const minute = Number(
          relative[4] ?? relative[5] ?? (relative[0].includes("半") ? 30 : 0),
        );
        afterAt = parseFollowupTime(
          `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
          zone,
        );
        timeQuote = relative[0];
      }
    }
  } catch {
    return undefined;
  }
  if (!afterAt || !timeQuote || +afterAt > +at + 7 * 86400000) return undefined;
  return { topic, afterAt, timeQuote };
}
async function latestRule(ruleId: string, reader: Tx | typeof db = db) {
  return (
    await reader
      .select()
      .from(proactiveRules)
      .where(eq(proactiveRules.ruleId, ruleId))
      .orderBy(desc(proactiveRules.version))
      .limit(1)
  )[0];
}
/** 只由新消息事务调用；不扫描/回填历史。独立导出允许隔离夹具使用自己的规则版本。 */
export async function recordInferenceSource(
  catId: string,
  messageId: string,
  options: { ruleId?: string } = {},
  transaction?: Tx,
) {
  const work = async (tx: Tx) => {
    const cat = await lockMemory(tx, catId);
    if (
      !cat.allowProactive ||
      !cat.useMemories ||
      config.AGENT_ENABLED !== "true"
    )
      return;
    const [source] = await tx
      .select({ m: messages })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(messages.id, messageId),
          eq(conversations.catId, catId),
          eq(messages.role, "user"),
          eq(messages.contextAllowed, true),
        ),
      );
    if (
      !source ||
      !outcomeTopic(source.m.text) ||
      /提醒我|问我|约好了/.test(source.m.text)
    )
      return;
    const ruleId = options.ruleId ?? "ask_outcome",
      rule = await latestRule(ruleId, tx);
    if (!rule || rule.mode === "off") return;
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, cat.userId));
    const [trigger] = await tx
      .insert(triggers)
      .values({
        catId,
        source: "chat",
        idempotencyKey: `inference:${ruleId}:${messageId}`,
        payload: {
          message_id: messageId,
          inference_rule: ruleId,
          permission_revision: cat.proactiveRevision,
          time_zone: user!.timeZone,
        },
      })
      .onConflictDoNothing()
      .returning();
    if (trigger)
      await tx
        .insert(asyncJobs)
        .values({
          kind: "inference",
          sourceId: trigger.id,
          objectId: trigger.id,
          version: "v1",
        })
        .onConflictDoNothing();
  };
  return transaction ? work(transaction) : db.transaction(work);
}
export type InferenceSnapshot = {
  cat: typeof cats.$inferSelect;
  user: typeof users.$inferSelect;
  conversation: typeof conversations.$inferSelect;
  source: typeof messages.$inferSelect;
  trigger: typeof triggers.$inferSelect;
  rule: typeof proactiveRules.$inferSelect;
  event: ReturnType<typeof outcomeEvent>;
  denial?: string;
  stamp: string;
  recent: { id: string; text: string }[];
};
export async function readInferenceSnapshot(
  triggerId: string,
  ruleId = "ask_outcome",
  reader: Tx | typeof db = db,
): Promise<InferenceSnapshot | null> {
  const [trigger] = await reader
    .select()
    .from(triggers)
    .where(eq(triggers.id, triggerId));
  if (!trigger) return null;
  const [ticket] = trigger.payload.ticket_id
    ? await reader
        .select()
        .from(tickets)
        .where(eq(tickets.id, trigger.payload.ticket_id))
    : [];
  const id = trigger.payload.message_id ?? ticket?.sourceMessageId;
  if (!id) return null;
  const [row] = await reader
    .select({
      cat: cats,
      user: users,
      conversation: conversations,
      source: messages,
    })
    .from(cats)
    .innerJoin(users, eq(users.id, cats.userId))
    .innerJoin(conversations, eq(conversations.catId, cats.id))
    .innerJoin(
      messages,
      and(eq(messages.conversationId, conversations.id), eq(messages.id, id)),
    )
    .where(eq(cats.id, trigger.catId));
  if (!row) return null;
  const rule = await latestRule(ruleId, reader);
  if (!rule) return null;
  const { cat, user, conversation, source } = row,
    permissions = await recallPermissions(cat.id, reader);
  const [watch] = trigger.payload.watch_id
    ? await reader
        .select()
        .from(inferenceWatches)
        .where(eq(inferenceWatches.id, trigger.payload.watch_id))
    : [];
  const expectedRevision =
    trigger.payload.permission_revision ??
    (ticket?.mandate.kind === "inferred"
      ? ticket.mandate.permission_revision
      : undefined);
  let denial: string | undefined;
  if (config.AGENT_ENABLED !== "true") denial = "agent_disabled";
  else if (rule.mode === "off") denial = "rule_off";
  else if (!cat.allowProactive || expectedRevision !== cat.proactiveRevision)
    denial = "permission_changed";
  else if (!cat.useMemories) denial = "memory_off";
  else if (
    source.role !== "user" ||
    !source.contextAllowed ||
    permissions.suppressedSources.has(source.id)
  )
    denial = "source_unavailable";
  else if (overlapsBoundaries(item(source.text), permissions.boundaryTopics))
    denial = "boundary";
  else if (
    watch &&
    (watch.sourceMessageId !== source.id ||
      watch.catId !== cat.id ||
      watch.sourceHash !== sourceHash(source.text) ||
      watch.state === "ended")
  )
    denial = "source_changed";
  const event = outcomeEvent(
    source.text,
    source.createdAt,
    trigger.payload.time_zone ?? ticket?.timeZone ?? user.timeZone,
  );
  if (!event && !denial) denial = "time_unclear";
  const history = await reader
    .select({
      id: messages.id,
      text: messages.text,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.role, "user"),
        eq(messages.contextAllowed, true),
        gte(messages.seq, source.seq),
      ),
    )
    .orderBy(asc(messages.seq));
  const allowed = history.filter(
    (m) =>
      !permissions.suppressedSources.has(m.id) &&
      !overlapsBoundaries(item(m.text), permissions.boundaryTopics),
  );
  if (event && allowed.some((m) => isOutcome(m.text, event.topic)))
    denial = "already_resolved";
  const recent = allowed
    .slice(-6)
    .map((m) => ({ id: m.id, text: m.text.slice(0, 120) }));
  const stamp = sourceHash(
    JSON.stringify({
      source: sourceHash(source.text),
      allowed: source.contextAllowed,
      rule,
      version: conversation.version,
      revision: cat.memoryRevision,
      permission: cat.proactiveRevision,
      use: cat.useMemories,
      zone: user.timeZone,
      topics: permissions.boundaryTopics,
      suppressed: [...permissions.suppressedSources].sort(),
      denial,
      event,
    }),
  );
  return { ...row, trigger, rule, event, denial, stamp, recent };
}
async function recordDecision(
  tx: Tx,
  s: InferenceSnapshot | null,
  trigger: typeof triggers.$inferSelect,
  reason: string,
  outcome: "ignore" | "silent" = "ignore",
) {
  const prior = await tx
    .select()
    .from(decisions)
    .where(eq(decisions.triggerId, trigger.id));
  if (!prior.some((d) => d.outcome === outcome))
    await tx.insert(decisions).values({
      triggerId: trigger.id,
      outcome,
      reasons: [reason],
      ruleVersion: s?.rule.version ?? 0,
    });
  for (const ticketId of new Set(
    prior.flatMap((d) => (d.ticketId ? [d.ticketId] : [])),
  ))
    await tx
      .update(tickets)
      .set({
        status: "ended",
        stage: "dropped",
        endedReason: reason,
        updatedAt: sql`now()`,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.status, "open")));
  if (trigger.payload.watch_id)
    await tx
      .update(inferenceWatches)
      .set({ state: "ended" })
      .where(eq(inferenceWatches.id, trigger.payload.watch_id));
  if (trigger.payload.ticket_id)
    await tx
      .update(tickets)
      .set({
        status: "ended",
        stage: "dropped",
        endedReason: reason,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(tickets.id, trigger.payload.ticket_id),
          eq(tickets.status, "open"),
        ),
      );
}
export async function scanInferenceClock(at?: Date, catId?: string) {
  const now =
    at ??
    new Date(
      (
        await db.execute<{ instant: string }>(sql`select now() as instant`)
      )[0]!.instant,
    );
  if (config.AGENT_ENABLED !== "true") return;
  const due = await db
    .select()
    .from(inferenceWatches)
    .where(
      and(
        eq(inferenceWatches.state, "waiting"),
        lte(inferenceWatches.dueAt, now),
        catId ? eq(inferenceWatches.catId, catId) : undefined,
      ),
    )
    .limit(100);
  for (const watch of due)
    await db.transaction(async (tx) => {
      await lockMemory(tx, watch.catId);
      const [current] = await tx
        .select()
        .from(inferenceWatches)
        .where(eq(inferenceWatches.id, watch.id));
      if (current?.state !== "waiting") return;
      const [origin] = await tx
        .select()
        .from(triggers)
        .where(
          and(
            eq(triggers.catId, watch.catId),
            eq(triggers.source, "chat"),
            eq(
              triggers.idempotencyKey,
              `inference:${watch.ruleId}:${watch.sourceMessageId}`,
            ),
          ),
        );
      const [trigger] = await tx
        .insert(triggers)
        .values({
          catId: watch.catId,
          source: "clock",
          idempotencyKey: `clock:inference:${watch.id}:${watch.dueAt.toISOString()}`,
          payload: {
            message_id: watch.sourceMessageId,
            watch_id: watch.id,
            inference_rule: watch.ruleId,
            permission_revision: watch.permissionRevision,
            time_zone: origin?.payload.time_zone,
          },
        })
        .onConflictDoNothing()
        .returning();
      if (trigger)
        await tx
          .insert(asyncJobs)
          .values({
            kind: "inference",
            sourceId: trigger.id,
            objectId: trigger.id,
            version: "v1",
          })
          .onConflictDoNothing();
      await tx
        .update(inferenceWatches)
        .set({ state: "due" })
        .where(eq(inferenceWatches.id, watch.id));
    });
}
export async function processInference(
  triggerId: string,
  options: {
    now?: Date;
    ruleId?: string;
    route?: (snapshot: InferenceSnapshot) => Promise<unknown>;
    beforePublish?: () => Promise<void>;
  } = {},
): Promise<void | { retryAt: Date }> {
  const ruleId = options.ruleId ?? "ask_outcome";
  const [trigger] = await db
    .select()
    .from(triggers)
    .where(eq(triggers.id, triggerId));
  if (!trigger) return;
  const prior = await db
    .select({ d: decisions, t: tickets })
    .from(decisions)
    .leftJoin(tickets, eq(tickets.id, decisions.ticketId))
    .where(eq(decisions.triggerId, triggerId));
  if (
    prior.some((r) => !r.d.ticketId) ||
    (prior.length > 0 && prior.every((r) => !r.t || r.t.status === "ended"))
  )
    return;
  for (let attempt = 0; attempt < 3; attempt++) {
    const now =
      options.now ??
      new Date(
        (
          await db.execute<{ instant: string }>(sql`select now() as instant`)
        )[0]!.instant,
      );
    const snapshot = await readInferenceSnapshot(triggerId, ruleId);
    const denied =
      snapshot?.denial ?? (!snapshot ? "source_unavailable" : undefined);
    if (denied) {
      await db.transaction((tx) =>
        recordDecision(tx, snapshot, trigger, denied),
      );
      return;
    }
    const s = snapshot!;
    if (+now - +s.event!.afterAt > 86400000) {
      await db.transaction((tx) =>
        recordDecision(tx, s, trigger, "event_expired"),
      );
      return;
    }
    if (+s.event!.afterAt <= +now) {
      const at = availableAt(now, s.user.timeZone);
      if (+at > +now) return { retryAt: at };
    }
    let verdict: ReturnType<typeof reviewOutcome>;
    try {
      verdict = reviewOutcome(await (options.route ?? assessOutcome)(s), s);
    } catch {
      verdict = { decision: "ignore" };
    }
    const result = await db.transaction(async (tx) => {
      await lockMemory(tx, s.cat.id);
      await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, s.conversation.id))
        .for("update");
      await tx.execute(sql`lock table proactive_rules in share mode`);
      const current = await readInferenceSnapshot(triggerId, ruleId, tx);
      if (!current || current.stamp !== s.stamp)
        return { kind: "stale" as const };
      const done = await tx
        .select()
        .from(decisions)
        .where(eq(decisions.triggerId, triggerId));
      if (done.some((d) => !d.ticketId)) return { kind: "done" as const };
      if (verdict.decision !== "accept") {
        await recordDecision(
          tx,
          current,
          trigger,
          "router_" + verdict.decision,
          verdict.decision === "silent" ? "silent" : "ignore",
        );
        return { kind: "done" as const };
      }
      if (+s.event!.afterAt > +now) {
        await tx
          .insert(inferenceWatches)
          .values({
            catId: s.cat.id,
            sourceMessageId: s.source.id,
            sourceHash: sourceHash(s.source.text),
            ruleId,
            topic: s.event!.topic,
            dueAt: s.event!.afterAt,
            permissionRevision: s.cat.proactiveRevision,
          })
          .onConflictDoNothing();
        await recordDecision(tx, s, trigger, "wait_clock", "silent");
        return { kind: "done" as const };
      }
      if (s.rule.mode === "observe") {
        await tx
          .insert(inferenceObservations)
          .values({
            catId: s.cat.id,
            sourceMessageId: s.source.id,
            sourceHash: sourceHash(s.source.text),
            ruleId,
            ruleVersion: s.rule.version,
            topic: s.event!.topic,
            observedAt: now,
          })
          .onConflictDoNothing();
        await recordDecision(tx, s, trigger, "observe_would_ask");
        return { kind: "done" as const };
      }
      const [published] = await tx
        .select()
        .from(inferredPublications)
        .where(eq(inferredPublications.sourceMessageId, s.source.id));
      if (published) {
        await recordDecision(tx, s, trigger, "already_published");
        return { kind: "done" as const };
      }
      let [ticket] = await tx
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.catId, s.cat.id),
            eq(tickets.sourceMessageId, s.source.id),
            eq(tickets.status, "open"),
            sql`${tickets.mandate}->>'kind'='inferred'`,
          ),
        )
        .orderBy(desc(tickets.createdAt))
        .limit(1);
      if (
        ticket &&
        ticket.mandate.kind === "inferred" &&
        (ticket.mandate.version !== s.rule.version ||
          ticket.mandate.source_hash !== sourceHash(s.source.text))
      ) {
        await tx
          .update(tickets)
          .set({
            status: "ended",
            stage: "dropped",
            endedReason: "assessment_changed",
          })
          .where(eq(tickets.id, ticket.id));
        ticket = undefined;
      }
      if (!ticket) {
        [ticket] = await tx
          .insert(tickets)
          .values({
            catId: s.cat.id,
            kind: "followup",
            goal: `${outcomeTopics[s.event!.topic]}后来怎么样`,
            mandate: {
              kind: "inferred",
              rule_id: ruleId,
              version: s.rule.version,
              source_message_id: s.source.id,
              source_hash: sourceHash(s.source.text),
              permission_revision: s.cat.proactiveRevision,
              topic: s.event!.topic,
            },
            sourceMessageId: s.source.id,
            dueAt: s.event!.afterAt,
            timeZone: s.user.timeZone,
            stage: "inferred_pending",
          })
          .returning();
      }
      if (!done.some((d) => d.ticketId === ticket!.id))
        await tx.insert(decisions).values({
          triggerId,
          ticketId: ticket!.id,
          outcome: "accept",
          ruleVersion: s.rule.version,
          reasons: ["inferred_evidence_verified"],
        });
      return { kind: "publish" as const, ticket: ticket! };
    });
    if (result.kind === "stale") continue;
    if (result.kind === "done") return;
    await options.beforePublish?.();
    const token = randomUUID();
    if (!(await acquireConversationLock(s.conversation.id, token, 300)))
      return { retryAt: new Date(+now + 30000) };
    try {
      const sent = await publishInferredFollowup({
        snapshot: s,
        ticketId: result.ticket.id,
        lockToken: token,
        now: options.now,
      });
      if (sent === "stale") continue;
      if (typeof sent === "object") return sent;
      return;
    } finally {
      await releaseConversationLock(s.conversation.id, token);
    }
  }
  return { retryAt: new Date(+(options.now ?? new Date()) + 30000) };
}
/** 48小时完整归因窗口；只输出聚合，来源撤回/改写/边界抑制后不计入。 */
export async function outcomeMetrics(
  options: { now?: Date; catId?: string } = {},
) {
  const now =
    options.now ??
    new Date(
      (
        await db.execute<{ instant: string }>(sql`select now() as instant`)
      )[0]!.instant,
    );
  const rows = await db
    .select({
      o: inferenceObservations,
      m: messages,
      v: conversations,
      c: cats,
    })
    .from(inferenceObservations)
    .innerJoin(messages, eq(messages.id, inferenceObservations.sourceMessageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(cats, eq(cats.id, inferenceObservations.catId))
    .where(
      options.catId
        ? eq(inferenceObservations.catId, options.catId)
        : undefined,
    );
  let total = 0,
    matured = 0,
    volunteered = 0;
  for (const { o, m, v, c } of rows) {
    if (
      !m.contextAllowed ||
      m.role !== "user" ||
      v.catId !== c.id ||
      sourceHash(m.text) !== o.sourceHash ||
      !c.useMemories
    )
      continue;
    const permission = await recallPermissions(c.id);
    if (
      permission.suppressedSources.has(m.id) ||
      overlapsBoundaries(item(m.text), permission.boundaryTopics)
    )
      continue;
    total++;
    if (+now < +o.observedAt + 48 * 3600000) continue;
    matured++;
    const subsequent = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, v.id),
          eq(messages.role, "user"),
          eq(messages.contextAllowed, true),
          gt(messages.seq, m.seq),
          gt(messages.createdAt, o.observedAt),
          lte(messages.createdAt, new Date(+o.observedAt + 48 * 3600000)),
        ),
      );
    if (
      subsequent.some(
        (r) =>
          !permission.suppressedSources.has(r.id) &&
          !overlapsBoundaries(item(r.text), permission.boundaryTopics) &&
          isOutcome(r.text, o.topic as OutcomeTopic),
      )
    )
      volunteered++;
  }
  return {
    would_ask_total: total,
    matured,
    volunteered,
    ratio: matured ? volunteered / matured : null,
    pending: total - matured,
  };
}
