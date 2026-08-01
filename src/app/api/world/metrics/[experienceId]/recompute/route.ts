import { NextResponse } from 'next/server';
import { recomputeMetrics } from '@/lib/world/metrics-service';

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const metrics = await recomputeMetrics(experienceId);
  return NextResponse.json({ metrics });
}
