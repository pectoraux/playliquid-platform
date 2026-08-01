import { NextResponse } from 'next/server';
import { getChronicle } from '@/lib/multiverse/multiverse-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId') ?? undefined;
  const events = await getChronicle(worldId, 30);
  return NextResponse.json({ events });
}
