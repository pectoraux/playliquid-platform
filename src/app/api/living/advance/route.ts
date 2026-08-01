import { NextRequest, NextResponse } from 'next/server';
import { advanceTime } from '@/lib/living/civilization-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const worldId = body.worldId;
  const ticks = body.ticks ?? 1;
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const result = await advanceTime(worldId, ticks);
  return NextResponse.json(result);
}
