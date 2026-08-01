import { NextResponse } from 'next/server';
import { getInsights } from '@/lib/creator-intel/ai-team-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creatorId') ?? 'creator_demo';
  const experienceId = url.searchParams.get('experienceId') ?? undefined;
  const insights = await getInsights(creatorId, experienceId);
  return NextResponse.json({ insights });
}
