import { NextResponse } from 'next/server';
import { getLifecycleTimeline, checkLifecycleMilestones } from '@/lib/identity-universe/community-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const exp = await (await import('@/lib/db')).db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (exp) await checkLifecycleMilestones(experienceId, exp.title);
  const timeline = await getLifecycleTimeline(experienceId);
  return NextResponse.json({ timeline });
}
