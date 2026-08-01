import { NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/world/discovery-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
  const recs = await getRecommendations(userId, limit);
  return NextResponse.json({ recommendations: recs });
}
