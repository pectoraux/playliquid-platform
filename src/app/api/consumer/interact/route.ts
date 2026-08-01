import { NextRequest, NextResponse } from 'next/server';
import { recordInteraction, type PlayInteraction } from '@/lib/consumer/discover-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  await recordInteraction({
    userId: body.userId ?? 'demo-user',
    experienceId: body.experienceId,
    interaction: body.interaction as PlayInteraction,
    metadata: body.metadata,
  });
  return NextResponse.json({ ok: true });
}
