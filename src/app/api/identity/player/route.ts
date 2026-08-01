import { NextResponse } from 'next/server';
import { getFullPlayerIdentity } from '@/lib/identity/player-identity-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const identity = await getFullPlayerIdentity(userId);
  if (!identity) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ identity });
}
