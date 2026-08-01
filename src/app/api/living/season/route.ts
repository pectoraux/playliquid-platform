import { NextResponse } from 'next/server';
import { getCurrentSeason } from '@/lib/living/civilization-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const season = await getCurrentSeason(worldId);
  return NextResponse.json({ season });
}
