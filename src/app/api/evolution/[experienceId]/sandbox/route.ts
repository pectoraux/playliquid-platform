import { NextRequest, NextResponse } from 'next/server';
import { runSandbox, runEvolutionExperiment } from '@/lib/evolution/sandbox-service';

// POST /api/evolution/[experienceId]/sandbox
//   { mutationId, mode: "simulate" | "experiment", playerCount? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const body = await req.json().catch(() => ({}));
  const mutationId = body.mutationId;
  if (!mutationId) return NextResponse.json({ error: 'mutationId required' }, { status: 400 });

  const mode = body.mode === 'experiment' ? 'experiment' : 'simulate';
  const playerCount = body.playerCount ? Number(body.playerCount) : undefined;

  if (mode === 'experiment') {
    const result = await runEvolutionExperiment({ experienceId, mutationId, playerCount });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ run: result.run });
  }

  const result = await runSandbox({ experienceId, mutationId, playerCount });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
