import { NextResponse } from 'next/server';
import { getSimulationRuns } from '@/lib/world/simulation-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const runs = await getSimulationRuns(experienceId);
  return NextResponse.json({ runs });
}
