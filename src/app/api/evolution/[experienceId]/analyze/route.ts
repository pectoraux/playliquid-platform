import { NextResponse } from 'next/server';
import { runEvolutionEngine } from '@/lib/evolution/evolution-engine';

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await runEvolutionEngine(experienceId);
  if (result.error) {
    return NextResponse.json({ error: result.error, proposal: result.proposal }, { status: result.proposal ? 200 : 422 });
  }
  return NextResponse.json({ proposal: result.proposal });
}
