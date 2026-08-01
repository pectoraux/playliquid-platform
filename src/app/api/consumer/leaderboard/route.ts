import { NextResponse } from 'next/server';
import { getGlobalLeaderboard } from '@/lib/consumer/game-page-service';

export async function GET() {
  const leaderboard = await getGlobalLeaderboard(20);
  return NextResponse.json({ leaderboard });
}
