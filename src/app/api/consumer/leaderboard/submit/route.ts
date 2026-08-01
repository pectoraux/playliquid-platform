import { NextRequest, NextResponse } from 'next/server';
import { submitLeaderboardEntry } from '@/lib/consumer/game-page-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  await submitLeaderboardEntry({
    experienceId: body.experienceId,
    userId: body.userId,
    displayName: body.displayName,
    score: body.score,
    sessionId: body.sessionId,
  });
  return NextResponse.json({ ok: true });
}
