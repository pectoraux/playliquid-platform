import { NextResponse } from 'next/server';
import { getEvolutionStage } from '@/lib/creator-intel/evolution-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const result = await getEvolutionStage(experienceId);
  return NextResponse.json(result);
}
