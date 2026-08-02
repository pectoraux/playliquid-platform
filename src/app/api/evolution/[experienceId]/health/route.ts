import { NextResponse } from 'next/server';
import { getExperienceHealth } from '@/lib/evolution/timeline-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const health = await getExperienceHealth(experienceId);
  if (!health) return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  return NextResponse.json(health);
}
