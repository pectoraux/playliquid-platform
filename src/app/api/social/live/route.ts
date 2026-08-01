import { NextResponse } from 'next/server';
import { getLiveSessions, goLive } from '@/lib/social/social-service';

export async function GET() {
  const sessions = await getLiveSessions(10);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const body = await req.json();
  const result = await goLive(body);
  return NextResponse.json(result);
}
