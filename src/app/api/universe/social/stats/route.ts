import { NextResponse } from 'next/server';
import { getSocialStats } from '@/lib/universe/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const stats = await getSocialStats(userId);
  return NextResponse.json({ stats });
}
