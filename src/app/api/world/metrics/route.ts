import { NextResponse } from 'next/server';
import { getAllMetrics, getMetrics } from '@/lib/world/metrics-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const experienceId = url.searchParams.get('experienceId');
  if (experienceId) {
    const metrics = await getMetrics(experienceId);
    return NextResponse.json({ metrics });
  }
  const all = await getAllMetrics();
  return NextResponse.json({ metrics: all });
}
