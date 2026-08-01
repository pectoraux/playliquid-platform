import { NextResponse } from 'next/server';
import { getWhatChanged } from '@/lib/living/civilization-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  const hours = parseInt(url.searchParams.get('hours') ?? '24', 10);
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const result = await getWhatChanged(worldId, hours);
  return NextResponse.json(result);
}
