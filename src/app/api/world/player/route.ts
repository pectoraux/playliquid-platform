import { NextResponse } from 'next/server';
import { getPlayerIdentity, ensureDemoPlayer } from '@/lib/world/player-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  await ensureDemoPlayer();
  const identity = await getPlayerIdentity(userId);
  return NextResponse.json({ identity });
}
