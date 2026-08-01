import { NextResponse } from 'next/server';
import { getActivityFeed, getUserFeed } from '@/lib/universe/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const feed = userId ? await getUserFeed(userId, limit) : await getActivityFeed(limit);
  return NextResponse.json({ feed });
}
