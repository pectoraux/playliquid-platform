import { NextResponse } from 'next/server';
import { getEvolutionTimeline } from '@/lib/evolution/timeline-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const timeline = await getEvolutionTimeline(experienceId);
  return NextResponse.json(timeline);
}
