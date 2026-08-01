import { NextRequest, NextResponse } from 'next/server';
import { migratePlayer, getPlayerMigrations } from '@/lib/multiverse/multiverse-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const migrations = await getPlayerMigrations(userId);
  return NextResponse.json({ migrations });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await migratePlayer(body);
  return NextResponse.json(result);
}
