import { NextRequest, NextResponse } from 'next/server';
import { quickPlay } from '@/lib/universe/play-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.userId ?? 'demo-user';
  const ticks = body.ticks ?? 30;
  const result = await quickPlay({ experienceId, userId, ticks });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ result: result.result });
}
