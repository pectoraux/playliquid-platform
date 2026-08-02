import { NextResponse } from 'next/server';
import { getEvolutionRuns } from '@/lib/evolution/sandbox-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const runs = await getEvolutionRuns(experienceId);
  return NextResponse.json({ runs });
}
