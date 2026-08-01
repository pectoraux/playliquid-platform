import { NextResponse } from 'next/server';
import { getCivilizationFeed, getGlobalFeed } from '@/lib/living/civilization-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  const global = url.searchParams.get('global') === 'true';
  const feed = worldId ? await getCivilizationFeed(worldId) : await getGlobalFeed();
  return NextResponse.json({ feed });
}
