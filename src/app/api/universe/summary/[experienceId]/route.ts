import { NextResponse } from 'next/server';
import { getExperienceSummary } from '@/lib/universe/curator-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const summary = await getExperienceSummary(experienceId);
  return NextResponse.json({ summary });
}
