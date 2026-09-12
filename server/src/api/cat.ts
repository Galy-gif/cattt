import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './auth.ts';
import { bad, notFound } from './responses.ts';
import { eq } from 'drizzle-orm';
import { db, dbNow } from '../db/client.ts';
import { cats, personalityVersions } from '../db/schema.ts';
import { APPEARANCES, TEMPERAMENTS } from '../runtime/persona.ts';

export const catRoutes = new Hono<Env>();

// ---- 猫 ----

const catBody = z.object({
  name: z.string().trim().min(1).max(20),
  appearance: z.enum(Object.keys(APPEARANCES) as [string, ...string[]]),
  temperament: z.enum(Object.keys(TEMPERAMENTS) as [string, ...string[]]),
  traits: z.object({
    energy: z.number().int().min(0).max(2),
    initiative: z.number().int().min(0).max(2),
    directness: z.number().int().min(0).max(2),
    closeness: z.number().int().min(0).max(2),
  }),
});

const catJson = (cat: typeof cats.$inferSelect) => ({
  id: cat.id,
  name: cat.name,
  appearance: cat.appearance,
  temperament: cat.temperament,
  traits: cat.traits,
  persona_version: cat.personaVersion,
});

catRoutes.get('/cat', async (c) => {
  const [cat] = await db.select().from(cats).where(eq(cats.id, c.get('owner').catId));
  return c.json(catJson(cat!));
});

catRoutes.put('/cat', async (c) => {
  const body = catBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(bad(z.prettifyError(body.error)), 400);
  const cat = await db.transaction(async tx => {
    const [current] = await tx.select().from(cats).where(eq(cats.id, c.get('owner').catId)).for('update');
    const profile = (value: typeof cats.$inferSelect) => ({ name: value.name, appearance: value.appearance, temperament: value.temperament, traits: value.traits });
    await tx.insert(personalityVersions).values({ catId: current!.id, version: current!.personaVersion, profile: profile(current!) }).onConflictDoNothing();
    const personaChanged = current!.temperament !== body.data.temperament || JSON.stringify(current!.traits) !== JSON.stringify(body.data.traits);
    const [updated] = await tx.update(cats).set({ ...body.data, personaVersion: current!.personaVersion + (personaChanged ? 1 : 0), updatedAt: dbNow() })
      .where(eq(cats.id, current!.id)).returning();
    if (personaChanged) await tx.insert(personalityVersions).values({ catId: updated!.id, version: updated!.personaVersion, profile: profile(updated!) });
    return updated!;
  });
  return c.json(catJson(cat!));
});
