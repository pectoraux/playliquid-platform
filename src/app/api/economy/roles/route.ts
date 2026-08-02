import { NextResponse } from 'next/server';
import { getPlayerRoles, getPlayerRole, updatePlayerRole } from '@/lib/living/economy-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const worldId = url.searchParams.get('worldId');
  if (worldId) {
    const role = await getPlayerRole(userId, worldId);
    return NextResponse.json({ role });
  }
  const roles = await getPlayerRoles(userId);
  return NextResponse.json({ roles });
}

export async function POST(req: Request) {
  const body = await req.json();
  await updatePlayerRole(body.userId ?? 'demo-user', body.worldId, body.worldName ?? '', body.displayName ?? 'Player');
  return NextResponse.json({ ok: true });
}
