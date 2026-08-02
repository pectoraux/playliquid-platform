import { NextResponse } from 'next/server';
import { getCreatorIntelligenceLeaderboard } from '@/lib/intelligence/creator-intelligence-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const creators = await getCreatorIntelligenceLeaderboard(limit);
  return NextResponse.json({ creators });
}
