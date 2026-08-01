import { NextResponse } from 'next/server';
import { getMissions } from '@/lib/living/civilization-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const missions = await getMissions(worldId);
  return NextResponse.json({ missions });
}
