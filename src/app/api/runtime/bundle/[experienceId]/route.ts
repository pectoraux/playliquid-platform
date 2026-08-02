import { NextResponse } from 'next/server';
import { getExperienceRuntime } from '@/lib/runtime/runtime-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const runtime = await getExperienceRuntime(experienceId);
  if (!runtime) return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  return NextResponse.json({ runtime });
}
