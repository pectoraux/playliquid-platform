import { NextResponse } from 'next/server';
import { getCuratorRecommendations } from '@/lib/universe/curator-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const result = await getCuratorRecommendations(userId, 5);
  return NextResponse.json(result);
}
