import { NextResponse } from 'next/server';
import { getLeaderboard, getPlayerRank, type LeaderboardCycle } from '@/lib/competition/leaderboard-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  const cycle = (url.searchParams.get('cycle') ?? 'all-time') as LeaderboardCycle;
  const userId = url.searchParams.get('userId');
  
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  
  if (userId) {
    const rank = await getPlayerRank(experienceId, userId);
    return NextResponse.json({ rank });
  }
  
  const leaderboard = await getLeaderboard(experienceId, cycle);
  return NextResponse.json({ leaderboard, cycle });
}
