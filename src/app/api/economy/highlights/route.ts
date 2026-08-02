import { NextResponse } from 'next/server';
import { getHighlights } from '@/lib/economy/highlight-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId') ?? undefined;
  const highlights = await getHighlights(experienceId, 20);
  return NextResponse.json({ highlights });
}
