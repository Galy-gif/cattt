import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { cats, tickets, inferenceWatches } from "../db/schema.ts";
import { lockMemory } from "../memory/control.ts";
export const proactivePermissionJSON = (cat: typeof cats.$inferSelect) => ({
  allow_proactive: cat.allowProactive,
  revision: cat.proactiveRevision,
});
export async function setProactivePermission(catId: string, allowed: boolean) {
  return db.transaction(async (tx) => {
    const cat = await lockMemory(tx, catId);
    if (cat.allowProactive === allowed) return proactivePermissionJSON(cat);
    const [next] = await tx
      .update(cats)
      .set({
        allowProactive: allowed,
        proactiveRevision: sql`${cats.proactiveRevision}+1`,
      })
      .where(eq(cats.id, catId))
      .returning();
    if (!allowed) {
      await tx
        .update(tickets)
        .set({
          status: "ended",
          stage: "dropped",
          endedReason: "proactive_permission_off",
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(tickets.catId, catId),
            eq(tickets.status, "open"),
            sql`${tickets.kind}<>'diary' and ${tickets.mandate}->>'kind'='inferred'`,
          ),
        );
      await tx
        .update(inferenceWatches)
        .set({ state: "ended" })
        .where(eq(inferenceWatches.catId, catId));
    }
    return proactivePermissionJSON(next!);
  });
}
