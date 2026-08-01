import { NextResponse } from 'next/server';
import { getRecommendedCivilizations } from '@/lib/multiverse/multiverse-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const recs = await getRecommendedCivilizations(userId, 5);
  return NextResponse.json({ recommendations: recs });
}
