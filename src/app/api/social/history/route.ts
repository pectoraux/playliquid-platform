import { NextRequest, NextResponse } from 'next/server';
import { recordPlay, getPlayHistory } from '@/lib/social/engagement-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { experienceId, experienceTitle, userId, score, durationMs } = body;
  if (!experienceId) return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
  await recordPlay({ experienceId, experienceTitle: experienceTitle ?? '', userId: userId ?? 'demo-user', score, durationMs });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const history = await getPlayHistory(userId);
  return NextResponse.json({ history });
}
