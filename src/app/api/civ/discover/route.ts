import { NextResponse } from 'next/server';
import { getWorldRecommendations } from '@/lib/civ/world-discovery';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const recs = await getWorldRecommendations(userId, 10);
  return NextResponse.json({ recommendations: recs });
}
