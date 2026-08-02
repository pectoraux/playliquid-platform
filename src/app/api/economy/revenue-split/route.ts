import { NextResponse } from 'next/server';
import { getPrizePool } from '@/lib/economy/revenue-split-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  const pool = await getPrizePool(experienceId);
  return NextResponse.json({ pool });
}
