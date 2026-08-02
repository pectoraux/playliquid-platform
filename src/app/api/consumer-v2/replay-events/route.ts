import { NextRequest, NextResponse } from 'next/server';
import { getReplayEvents, addReplayEvent } from '@/lib/consumer-v2/consumer-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const replayId = url.searchParams.get('replayId');
  if (!replayId) return NextResponse.json({ error: 'replayId required' }, { status: 400 });
  const events = await getReplayEvents(replayId);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  await addReplayEvent(body);
  return NextResponse.json({ ok: true });
}
