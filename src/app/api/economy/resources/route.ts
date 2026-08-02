import { NextResponse } from 'next/server';
import { getResources, initializeResources } from '@/lib/living/economy-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  await initializeResources(worldId, '').catch(() => {});
  const resources = await getResources(worldId);
  return NextResponse.json({ resources });
}
