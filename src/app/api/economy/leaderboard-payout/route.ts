import { NextRequest, NextResponse } from 'next/server';
import { processPayoutCycle, getPayoutHistory, getPlayerWinnings } from '@/lib/economy/leaderboard-payout-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  const userId = url.searchParams.get('userId');
  if (userId) {
    const winnings = await getPlayerWinnings(userId);
    return NextResponse.json({ winnings });
  }
  if (experienceId) {
    const history = await getPayoutHistory(experienceId);
    return NextResponse.json({ history });
  }
  return NextResponse.json({ error: 'experienceId or userId required' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await processPayoutCycle(body.experienceId, body.cycleLabel);
  return NextResponse.json(result);
}
