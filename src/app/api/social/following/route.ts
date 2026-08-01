import { NextResponse } from 'next/server';
import { getFollowingFeed } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const feed = await getFollowingFeed(userId);
  return NextResponse.json({ feed });
}
