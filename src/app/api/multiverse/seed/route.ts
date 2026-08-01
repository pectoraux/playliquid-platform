import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureWorldIdentity, updateWorldStats } from '@/lib/multiverse/multiverse-service';

export async function POST() {
  const worlds = await db.worldRecord.findMany();
  let count = 0;
  for (const world of worlds) {
    const exp = await db.experienceRecord.findUnique({ where: { id: world.experienceId }, include: { creator: true } });
    if (exp) {
      await ensureWorldIdentity(world.id, world.name, exp.creatorId, exp.creator?.displayName ?? 'Unknown');
      await updateWorldStats(world.id);
      count++;
    }
  }
  return NextResponse.json({ seeded: count });
}
