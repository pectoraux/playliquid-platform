import { NextResponse } from 'next/server';
import { getInsights } from '@/lib/creator-os/creator-studio-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId') ?? 'creator_demo';
  const insights = await getInsights(creatorId);
  return NextResponse.json({ insights });
}
