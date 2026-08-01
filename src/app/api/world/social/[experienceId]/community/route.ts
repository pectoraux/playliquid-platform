import { NextResponse } from 'next/server';
import { getCommunitySummary } from '@/lib/world/social-service';

export async function GET(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const summary = await getCommunitySummary(experienceId);
  return NextResponse.json({ community: summary });
}
