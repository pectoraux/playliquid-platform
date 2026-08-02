import { NextRequest, NextResponse } from 'next/server';
import { startCompetitiveSession, getCompetitiveSession } from '@/lib/competition/competitive-session-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await startCompetitiveSession(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  const session = await getCompetitiveSession(sessionId);
  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ session });
}
