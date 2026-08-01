import { NextResponse } from 'next/server';
import { getReplays } from '@/lib/social/social-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId') ?? undefined;
  const highlightType = url.searchParams.get('highlight') ?? undefined;
  const replays = await getReplays({ experienceId, highlightType, limit: 20 });
  return NextResponse.json({ replays });
}
