import { NextResponse } from 'next/server';
import { getEvolvedFeed } from '@/lib/identity-universe/community-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const feed = await getEvolvedFeed(userId);
  return NextResponse.json({ feed });
}
