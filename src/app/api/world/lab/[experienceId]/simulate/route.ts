import { NextRequest, NextResponse } from 'next/server';
import { runSimulation } from '@/lib/world/simulation-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json().catch(() => ({}));
  const playerCount = Math.min(body.playerCount ?? 10, 100);
  const result = await runSimulation({
    experienceId,
    playerCount,
    variantLabel: body.variantLabel,
    variantConfig: body.variantConfig,
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ runId: result.runId, sessionsRun: result.sessionsRun });
}
