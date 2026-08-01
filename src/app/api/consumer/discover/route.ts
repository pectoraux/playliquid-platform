import { NextResponse } from 'next/server';
import { getDiscoverFeed } from '@/lib/consumer/discover-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const feed = await getDiscoverFeed(userId);
  return NextResponse.json({ feed });
}
