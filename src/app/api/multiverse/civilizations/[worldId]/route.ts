import { NextResponse } from 'next/server';
import { getWorldIdentity, getWorldRelations, getWorldTrades, updateWorldStats } from '@/lib/multiverse/multiverse-service';

export async function GET(_req: Request, { params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  await updateWorldStats(worldId).catch(() => {});
  const [identity, relations, trades] = await Promise.all([
    getWorldIdentity(worldId),
    getWorldRelations(worldId),
    getWorldTrades(worldId),
  ]);
  if (!identity) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ identity, relations, trades });
}
