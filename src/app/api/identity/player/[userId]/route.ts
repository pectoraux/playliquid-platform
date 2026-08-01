import { NextResponse } from 'next/server';
import { ensurePlayerProfile } from '@/lib/identity/player-identity-service';

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  await ensurePlayerProfile(userId, `Player_${userId.slice(-4)}`);
  return NextResponse.json({ ok: true });
}
